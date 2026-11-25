// Checks that the auth forms never send a request without a Turnstile token (#177).
//
// Run it against a dev server started with Cloudflare's always-pass test key and the
// optional auth pages switched on, for example:
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA EMAIL_OTP_ENABLED=true \
//   ACCOUNT_EMAIL_ENABLED=true npm run dev -- -p 3061
//   TURNSTILE_CHECK_URL=http://localhost:3061 node scripts/verify-turnstile-hold.mjs
//
// Scenario A uses the real widget with the test key. The others replace the widget with a
// stand-in that answers late, fails, or never answers, to check the hold and resend logic.
// Sign-in requests reach the server with a fictional address and fail harmlessly; sign-up,
// email code and password reset requests are intercepted, so nothing reaches Supabase.
// Uses the installed Google Chrome with a fresh temporary profile.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.TURNSTILE_CHECK_URL ?? "http://localhost:3000";

const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${JSON.stringify(detail)}` : ""}`); };

// A stand-in for Cloudflare's widget. plan is a list of [delayMs, "token" | "error" | "expired"] events
// played after each render or reset.
function fakeTurnstile(plan) {
  const widgets = new Map();
  const play = (options) => {
    let at = 0;
    for (const [delay, kind] of plan) {
      at += delay;
      setTimeout(() => {
        if (kind === "token") options.callback?.(`fake-token-${Date.now()}`);
        if (kind === "error") options["error-callback"]?.();
        if (kind === "expired") options["expired-callback"]?.();
      }, at);
    }
  };
  window.__renders = 0;
  window.turnstile = {
    render(element, options) { const id = `w${widgets.size + 1}`; widgets.set(id, options); window.__renders++; play(options); return id; },
    reset(id) { const options = widgets.get(id); if (options) play(options); },
    remove(id) { widgets.delete(id); },
  };
}

async function newPage(browser, plan) {
  const context = await browser.newContext();
  const page = await context.newPage();
  if (plan) await page.addInitScript(fakeTurnstile, plan);
  const posts = [];
  const started = Date.now();
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) {
      const body = request.postDataBuffer()?.toString("utf8") ?? "";
      const token = /name="(?:_?\d+_)?captcha_token"\r\n\r\n([^\r]*)/.exec(body)?.[1] || null;
      posts.push({ at: Date.now() - started, token });
    }
  });
  return { context, page, posts, started };
}

const statusOf = (page) => page.locator("[data-turnstile-status]").first().getAttribute("data-turnstile-status");
const waitingShown = (page) => page.getByText("Your request will be sent as soon as the check finishes.").isVisible();

async function fillLogin(page) {
  await page.getByLabel("Email address").fill("fictional-check@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Not-a-real-password-1");
}

const browser = await chromium.launch({ channel: "chrome" });
try {
  // Warm the dev server so compile time does not count.
  { const { context, page } = await newPage(browser); await page.goto(`${origin}/login`); await page.goto(`${origin}/signup`); await context.close(); }

  // A: real widget with the always-pass test key, timed from navigation.
  const timings = [];
  for (let run = 0; run < 5; run++) {
    const { context, page } = await newPage(browser);
    const t0 = Date.now();
    await page.goto(`${origin}/login`, { waitUntil: "commit" });
    await page.locator('[data-turnstile-status="verified"]').waitFor({ timeout: 30000 });
    timings.push(Date.now() - t0);
    const scriptInitiator = await page.evaluate(() => performance.getEntriesByType("resource").find((e) => /turnstile\/v0\/api/.test(e.name))?.initiatorType);
    if (run === 0) record("A0 script comes from the preload in the page head", scriptInitiator === "link", { scriptInitiator });
    await context.close();
  }
  record("A1 always-pass key verifies on every load", timings.length === 5, { msFromNavigation: timings });

  // B: slow check (10 s). An early click is held, then sent once with the token.
  {
    const { context, page, posts } = await newPage(browser, [[10000, "token"]]);
    await page.goto(`${origin}/login`);
    await fillLogin(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForTimeout(1500);
    const heldEarly = posts.length === 0 && (await waitingShown(page)) && (await statusOf(page)) === "checking";
    await page.waitForFunction(() => document.querySelector("[data-turnstile-status]")?.getAttribute("data-turnstile-status") === "verified", null, { timeout: 15000 });
    await page.waitForTimeout(1500);
    record("B slow check: early click held, then sent once with a token", heldEarly && posts.length === 1 && Boolean(posts[0]?.token), { posts, heldEarly });
    await context.close();
  }

  // C: the check fails while a click is held. The click is sent at once so the server can
  // answer, and a later successful retry does not send anything by surprise.
  {
    const { context, page, posts } = await newPage(browser, [[800, "error"], [2500, "token"]]);
    await page.goto(`${origin}/login`);
    await fillLogin(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    // The server's answer resets the widget straight away, so catch the failed state as it happens.
    const failedShown = await page.waitForFunction(() => document.querySelector("[data-turnstile-status]")?.getAttribute("data-turnstile-status") === "failed", null, { timeout: 3000, polling: "raf" }).then(() => true, () => false);
    await page.waitForTimeout(1000);
    const sentOnFailure = posts.length === 1 && posts[0].at < 2500;
    await page.waitForTimeout(4000);
    record("C failure while held: sent once at the failure, nothing sent later", failedShown && sentOnFailure && posts.length === 1, { posts, failedShown });
    await context.close();
  }

  // L: Cloudflare's script is blocked (extension, firewall, offline). Clicks are not swallowed.
  {
    const { context, page, posts } = await newPage(browser);
    await page.route("https://challenges.cloudflare.com/**", (route) => route.abort());
    await page.goto(`${origin}/login`);
    await page.locator('[data-turnstile-status="failed"]').waitFor({ timeout: 15000 });
    await fillLogin(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForTimeout(2000);
    record("L script blocked: status failed, sign-in still sent", posts.length === 1 && !(await waitingShown(page)), { posts });
    await context.close();
  }

  // D: the check never finishes. Nothing is ever sent without a token.
  {
    const { context, page, posts } = await newPage(browser, []);
    await page.goto(`${origin}/login`);
    await fillLogin(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForTimeout(8000);
    record("D check never finishes: nothing sent, waiting message shown", posts.length === 0 && (await waitingShown(page)), { posts });
    await context.close();
  }

  // E: repeated clicks while waiting still send exactly one request.
  {
    const { context, page, posts } = await newPage(browser, [[5000, "token"]]);
    await page.goto(`${origin}/login`);
    await fillLogin(page);
    const button = page.getByRole("button", { name: "Sign in", exact: true });
    await button.click(); await page.waitForTimeout(300); await button.click(); await page.waitForTimeout(300); await button.click();
    await page.waitForTimeout(7000);
    record("E three clicks while waiting: exactly one request", posts.length === 1 && Boolean(posts[0]?.token), { posts });
    await context.close();
  }

  // F: token already there. The click is sent straight away, not held.
  {
    const { context, page, posts } = await newPage(browser, [[200, "token"]]);
    await page.goto(`${origin}/login`);
    await page.locator('[data-turnstile-status="verified"]').waitFor();
    await fillLogin(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForTimeout(1500);
    record("F token ready: sent immediately, no waiting message", posts.length === 1 && !(await waitingShown(page)), { posts });
    await context.close();
  }

  // G: after a rejected attempt the widget resets; the next click waits for the new token.
  {
    const { context, page, posts } = await newPage(browser, [[300, "token"]]);
    await page.goto(`${origin}/login`);
    await page.locator('[data-turnstile-status="verified"]').waitFor();
    await fillLogin(page);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.locator('[role="alert"], [data-slot="status-message"]').first().waitFor({ timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelector("[data-turnstile-status]")?.getAttribute("data-turnstile-status") === "verified", null, { timeout: 15000 });
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForTimeout(1500);
    const tokens = posts.map((p) => p.token);
    record("G second attempt after a server response carries a fresh token", posts.length === 2 && tokens.every(Boolean) && tokens[0] !== tokens[1], { posts });
    await context.close();
  }

  // H: sign-up form is held too. Submissions are intercepted so no account is created.
  {
    const { context, page, posts } = await newPage(browser, [[6000, "token"]]);
    await page.route("**/signup", (route) => route.request().method() === "POST" ? route.abort() : route.continue());
    await page.goto(`${origin}/signup`);
    await page.getByLabel("First name", { exact: true }).fill("Fictional");
    await page.getByLabel("Last name", { exact: true }).fill("Check");
    await page.getByLabel("Email", { exact: true }).fill("fictional-signup@example.test");
    await page.getByLabel("Password", { exact: true }).fill("Fictional-pass-123!");
    await page.getByLabel("Verify password", { exact: true }).fill("Fictional-pass-123!");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.waitForTimeout(1500);
    const heldEarly = posts.length === 0 && (await waitingShown(page));
    await page.waitForTimeout(6500);
    record("H sign-up: held until the token, then sent once", heldEarly && posts.length === 1 && Boolean(posts[0]?.token), { posts, heldEarly });
    await context.close();
  }

  // I: sign-up password validation still runs; a mismatched password is never sent.
  {
    const { context, page, posts } = await newPage(browser, [[3000, "token"]]);
    await page.route("**/signup", (route) => route.request().method() === "POST" ? route.abort() : route.continue());
    await page.goto(`${origin}/signup`);
    await page.getByLabel("First name", { exact: true }).fill("Fictional");
    await page.getByLabel("Last name", { exact: true }).fill("Check");
    await page.getByLabel("Email", { exact: true }).fill("fictional-signup@example.test");
    await page.getByLabel("Password", { exact: true }).fill("Fictional-pass-123!");
    await page.getByLabel("Verify password", { exact: true }).fill("Different-pass-123!");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.waitForTimeout(5000);
    record("I sign-up with mismatched passwords: never sent", posts.length === 0, { posts });
    await context.close();
  }

  // J and K: forms that share one widget placed outside the form (email code, password reset).
  for (const [label, path, button] of [["J email code", "/login/code", "Send sign-in code"], ["K password reset", "/forgot-password", "Send reset code"]]) {
    const { context, page, posts } = await newPage(browser, [[5000, "token"]]);
    await page.route(`**${path}`, (route) => route.request().method() === "POST" ? route.abort() : route.continue());
    await page.goto(`${origin}${path}`);
    await page.locator('input[type="email"]').first().fill("fictional-check@example.test");
    await page.getByRole("button", { name: button, exact: true }).click();
    await page.waitForTimeout(1500);
    const heldEarly = posts.length === 0 && (await waitingShown(page));
    await page.waitForTimeout(5000);
    record(`${label}: held until the token, then sent once`, heldEarly && posts.length === 1 && Boolean(posts[0]?.token), { posts, heldEarly });
    await context.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
assert.equal(failed.length, 0);
