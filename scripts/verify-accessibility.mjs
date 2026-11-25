// Issue #146: automated accessibility checks on the main pages in light and
// dark themes. Runs axe-core on each page and a non-text contrast check that
// form control borders reach 3:1 against what surrounds them (WCAG 1.4.11),
// which axe does not test.
//
// Scopes:
//   A11Y_SCOPE=public (default): public pages only. Needs a running production
//     build (npm run build && npm run start) and no database.
//   A11Y_SCOPE=all: also signs up disposable accounts and checks the member,
//     Mentor and administrator workspace. Only run through
//     scripts/run-accessibility.mjs, which owns an empty isolated local stack.
//
// Serious and critical findings fail the run unless they are listed, with the
// issue that tracks them, in scripts/accessibility-known-issues.json.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const app = new URL(process.env.A11Y_APP_URL ?? 'http://127.0.0.1:3000');
const scope = process.env.A11Y_SCOPE ?? 'public';
const output = process.env.A11Y_RESULTS ?? '/tmp/accessibility-results.json';
assert.ok(['public', 'all'].includes(scope), 'A11Y_SCOPE must be public or all');
assert.ok(['127.0.0.1', 'localhost'].includes(app.hostname), 'Loopback app targets only');
assert.equal(app.protocol, 'http:');

const THEMES = ['light', 'dark'];
const BLOCKING = new Set(['serious', 'critical']);
const PUBLIC_PAGES = ['/', '/about-developer', '/login', '/signup', '/forgot-password', '/privacy'];
const known = JSON.parse(readFileSync(new URL('./accessibility-known-issues.json', import.meta.url), 'utf8')).known;
const scans = [], blocking = [], tracked = [];
const report = { recordedAt: new Date().toISOString(), source: process.env.A11Y_SOURCE ?? 'working-tree', scope, app: app.origin, axeRules: 'axe default rule set', scans };

// Stored choices the app reads before hydration: functional storage allowed,
// analytics declined, so no banner covers the page and the theme is honoured.
const CONSENT = JSON.stringify({ version: 1, timestamp: '2026-11-24T00:00:00.000Z', preferences: { necessary: true, functional: true, analytics: false } });

// Runs in the page. Returns form controls whose boundary is under 3:1.
function controlBorderCheck() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // The canvas normalises any CSS colour (oklch, color-mix, named) to sRGB.
  const rgba = value => {
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255];
  };
  const over = (top, under) => { const a = top[3]; return [0, 1, 2].map(i => top[i] * a + under[i] * (1 - a)).concat(1); };
  const luminance = c => { const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  // Solid colour behind an element, composited from the root down. Background
  // images and gradients are ignored, so pages that rely on them need a look.
  const behind = element => {
    const chain = []; for (let node = element; node; node = node.parentElement) chain.unshift(getComputedStyle(node).backgroundColor);
    return chain.reduce((under, colour) => over(rgba(colour), under), [255, 255, 255, 1]);
  };
  const selector = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),textarea,select,[role=combobox],[role=textbox],[role=searchbox]';
  const failures = [];
  for (const element of document.querySelectorAll(selector)) {
    const style = getComputedStyle(element), box = element.getBoundingClientRect();
    // Disabled controls are exempt from 1.4.11; hidden ones (closed details,
    // zero opacity, aria-hidden) cannot be seen or reached.
    if (element.matches(':disabled') || box.width === 0 || box.height === 0 || element.closest('[aria-hidden=true],[inert]')) continue;
    if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const outside = element.parentElement ? behind(element.parentElement) : [255, 255, 255, 1];
    const fill = over(rgba(style.backgroundColor), outside);
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map(side => ({ width: parseFloat(style[`border${side}Width`]) || 0, colour: style[`border${side}Color`], line: style[`border${side}Style`] }))
      .filter(side => side.width > 0 && side.line !== 'none' && side.line !== 'hidden').sort((a, b) => b.width - a.width);
    const border = sides.length ? contrast(over(rgba(sides[0].colour), fill), outside) : 0;
    const ratio = Math.max(border, contrast(fill, outside));
    if (ratio < 3) {
      const name = element.getAttribute('aria-label') || element.labels?.[0]?.textContent?.trim() || element.getAttribute('placeholder') || element.id || element.tagName.toLowerCase();
      failures.push({ target: element.id ? `#${element.id}` : element.tagName.toLowerCase(), name: name.slice(0, 80), ratio: Math.round(ratio * 100) / 100 });
    }
  }
  return failures;
}

async function setTheme(page, theme) {
  await page.evaluate(([consent, value]) => { localStorage.setItem('alumnikonneqt-cookie-consent', consent); localStorage.setItem('alumnikonneqt-theme', value); }, [CONSENT, theme]);
}

function isKnown(scan, rule) {
  return known.find(entry => entry.rule === rule && entry.page === scan.path && (!entry.theme || entry.theme === scan.theme) && (!entry.account || entry.account === scan.account));
}

async function scan(page, { path, theme, account, state = 'default', expectPath = path }) {
  await page.waitForLoadState('networkidle').catch(() => {});
  const actual = new URL(page.url()).pathname;
  assert.equal(actual, expectPath, `${account} ${path} ended on ${actual}`);
  assert.ok(await page.locator('html').evaluate((node, value) => node.classList.contains(value), theme), `${path} did not apply the ${theme} theme`);
  const axe = await new AxeBuilder({ page }).analyze();
  const borders = await page.evaluate(controlBorderCheck);
  const record = { account, path, state, theme, violations: [] };
  for (const violation of axe.violations) {
    record.violations.push({ rule: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.length, targets: violation.nodes.slice(0, 5).map(node => node.target.join(' ')) });
  }
  if (borders.length) record.violations.push({ rule: 'control-border-contrast', impact: 'serious', help: 'Form control boundaries must reach 3:1 against adjacent colours (WCAG 1.4.11)', nodes: borders.length, targets: borders.slice(0, 5).map(item => `${item.target} "${item.name}" ${item.ratio}:1`) });
  for (const violation of record.violations) {
    if (!BLOCKING.has(violation.impact)) continue;
    const entry = isKnown(record, violation.rule);
    const line = `${account} ${path} [${state}, ${theme}] ${violation.rule} (${violation.impact}, ${violation.nodes} nodes): ${violation.targets.join('; ')}`;
    if (entry) { violation.trackedIn = entry.issue; tracked.push(`${line} -> #${entry.issue}`); }
    else blocking.push(line);
  }
  scans.push(record);
  const counts = record.violations.map(v => `${v.rule}:${v.impact}${v.trackedIn ? `(#${v.trackedIn})` : ''}`).join(', ') || 'none';
  console.log(`SCAN ${account} ${path} [${state}, ${theme}]: ${counts}`);
}

async function visit(page, path, theme, account, expectPath) {
  await page.goto(app.origin + path);
  await scan(page, { path, theme, account, expectPath });
}

let browser;
const accounts = [];
let admin;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  report.browserVersion = browser.version();
  const newContext = async () => {
    // Reduced motion settles entrance animations so contrast is measured on final colours.
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
    await context.route('**/_vercel/**', route => route.fulfill({ body: '' }));
    return context;
  };

  // First visit: the cookie banner is open and the theme is always light.
  const visitor = await newContext();
  const first = await visitor.newPage(); first.setDefaultTimeout(30_000);
  await first.goto(app.origin + '/');
  await first.getByRole('button', { name: 'Reject Non-Essential', exact: true }).waitFor();
  await scan(first, { path: '/', theme: 'light', account: 'visitor', state: 'cookie banner' });
  for (const theme of THEMES) {
    await setTheme(first, theme);
    for (const path of PUBLIC_PAGES) await visit(first, path, theme, 'visitor');
  }
  await visitor.close();

  if (scope === 'all') {
    const db = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    assert.ok(['127.0.0.1', 'localhost'].includes(db.hostname), 'Loopback databases only');
    assert.equal(db.port, '56421', 'Requires the dedicated accessibility stack, not the shared local database');
    admin = createClient(db.href, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const ok = (result, label) => { assert.ok(!result.error, `${label}: ${result.error?.message ?? 'unavailable'}`); return result.data; };
    assert.equal(ok(await admin.from('profiles').select('id'), 'Empty-stack guard').length, 0, 'Refusing a nonempty database');
    assert.equal(ok(await admin.auth.admin.listUsers({ page: 1, perPage: 1 }), 'Empty-account guard').users.length, 0, 'Refusing existing accounts');
    const run = randomUUID();

    // Same browser sign-up as the cold-start journey, on an auto-confirming stack.
    const signup = async (role, label, theme) => {
      const context = await newContext();
      const page = await context.newPage(); page.setDefaultTimeout(30_000);
      await page.goto(app.origin + '/signup');
      await setTheme(page, theme); await page.reload();
      const email = `a11y-${run}-${label.toLowerCase()}@example.test`, password = randomUUID() + 'Aa1!';
      await page.getByLabel('First name', { exact: true }).fill('Fictional');
      await page.getByLabel('Last name', { exact: true }).fill(label);
      await page.getByLabel('Email', { exact: true }).fill(email);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByLabel('Verify password', { exact: true }).fill(password);
      await page.locator(`input[name="role"][value="${role}"]`).check();
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      const proceed = page.getByRole('button', { name: 'Continue to your profile', exact: false });
      await proceed.waitFor();
      const user = ok(await admin.auth.admin.listUsers({ page: 1, perPage: 100 }), 'Find disposable account').users.find(u => u.email === email);
      assert.ok(user, 'Disposable account was not created');
      const person = { context, page, id: user.id, label };
      accounts.push(person);
      // The arrival pass plays over the sign-up page before moving on.
      await scan(page, { path: '/signup', theme, account: label.toLowerCase(), state: 'arrival after sign-up' });
      await proceed.click(); await page.waitForURL('**/profile');
      ok(await admin.from('email_preferences').upsert({ user_id: user.id, requests: false, connections: false, matches: false, reminders: false }), 'Disable fixture activity mail');
      return person;
    };
    const member = await signup('mentee', 'Member', 'light');
    const mentor = await signup('mentor', 'Mentor', 'dark');
    const second = await signup('mentor', 'Second', 'light');
    const staff = await signup('mentee', 'Admin', 'dark');

    // Fictional content so cards, requests, connections and reports render.
    const details = {
      [member.id]: { headline: 'Seeking backend engineering mentorship', skills: ['Python', 'PostgreSQL'], bio: 'Fictional member used by the accessibility check.', industry: 'Aviation', graduation_year: 2024 },
      [mentor.id]: { headline: 'Backend engineering Mentor', skills: ['Python', 'PostgreSQL'], bio: 'Fictional Mentor offering guidance on backend systems.', industry: 'Aviation', graduation_year: 2012 },
      [second.id]: { headline: 'Database systems Mentor', skills: ['PostgreSQL'], bio: 'Fictional Mentor offering guidance on database design.', industry: 'Technology', graduation_year: 2010 },
      [staff.id]: { headline: 'Community administrator', skills: [], bio: '', industry: '', graduation_year: null },
    };
    for (const [id, fields] of Object.entries(details)) ok(await admin.from('profiles').update(fields).eq('id', id), 'Fixture profile');
    ok(await admin.from('profiles').update({ role: 'admin' }).eq('id', staff.id), 'Promote fixture administrator');
    ok(await admin.from('mentorship_requests').insert([
      { mentee_id: member.id, mentor_id: mentor.id, message: 'Fictional pending request.' },
      { mentee_id: member.id, mentor_id: second.id, message: 'Fictional request to accept.' },
    ]), 'Fixture requests');
    ok(await admin.from('reports').insert({ reporter_id: member.id, reported_id: second.id, reason: 'spam', details: 'Fictional report for the review queue.' }), 'Fixture report');
    // The second Mentor accepts in the browser so the member has a connection.
    await second.page.goto(app.origin + '/requests');
    await second.page.getByRole('button', { name: 'Accept', exact: true }).click();
    for (let i = 0; i < 100 && ok(await admin.from('connections').select('id'), 'Connection').length === 0; i++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(ok(await admin.from('connections').select('id'), 'Connection count').length, 1, 'Fixture connection was not created');
    // A filled-in mentorship plan (#187), so badges, progress bars and milestone
    // controls are scanned as well as the empty plan.
    const [connection] = ok(await admin.from('connections').select('id'), 'Fixture connection');
    const objective = ok(await admin.from('mentorship_objectives')
      .insert({ connection_id: connection.id, title: 'Move into a backend engineering role' }).select('id').single(), 'Fixture objective');
    const pastDate = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    const milestones = ok(await admin.from('mentorship_milestones').insert([
      { objective_id: objective.id, connection_id: connection.id, title: 'Finish a PostgreSQL course', target_date: pastDate },
      { objective_id: objective.id, connection_id: connection.id, title: 'Build a small API project', target_date: pastDate },
      { objective_id: objective.id, connection_id: connection.id, title: 'Practise a technical interview' },
    ]).select('id, title'), 'Fixture milestones');
    const finished = milestones.find(item => item.title === 'Finish a PostgreSQL course');
    ok(await admin.from('mentorship_milestones').update({ completed_at: new Date().toISOString() }).eq('id', finished.id), 'Fixture milestone done');

    for (const theme of THEMES) {
      await setTheme(member.page, theme);
      for (const path of ['/discover', '/profile', '/profile/email-preferences', '/requests']) await visit(member.page, path, theme, 'member');
      // Keyword search renders Mentor passes without needing model inference.
      await member.page.goto(app.origin + '/discover');
      await member.page.getByRole('button', { name: 'Keyword search', exact: true }).click();
      await member.page.getByLabel('Search by name, skill, or field', { exact: true }).fill('PostgreSQL');
      await member.page.getByRole('button', { name: 'Search', exact: true }).click();
      await member.page.getByText('Backend engineering Mentor', { exact: false }).first().waitFor();
      await scan(member.page, { path: '/discover', theme, account: 'member', state: 'keyword results' });
      await member.page.getByRole('group', { name: 'Result layout' }).getByRole('button', { name: 'List', exact: true }).click();
      await scan(member.page, { path: '/discover', theme, account: 'member', state: 'keyword results list' });

      await setTheme(mentor.page, theme);
      for (const path of ['/discover', '/profile', '/requests']) await visit(mentor.page, path, theme, 'mentor');

      await setTheme(staff.page, theme);
      await visit(staff.page, '/admin', theme, 'admin');
    }

    // Issue #160: the workspace phone menu opens with one Sign out button,
    // closes with Escape and returns focus to its button.
    await member.page.setViewportSize({ width: 320, height: 800 });
    await member.page.goto(app.origin + '/requests');
    const openMenu = member.page.getByRole('button', { name: 'Open navigation', exact: true });
    await openMenu.click();
    const closeMenu = member.page.getByRole('button', { name: 'Close navigation', exact: true });
    assert.equal(await closeMenu.getAttribute('aria-expanded'), 'true', 'Workspace phone menu did not open');
    assert.equal(await member.page.getByRole('button', { name: 'Sign out', exact: true }).count(), 1, 'Workspace phone menu should show one Sign out button');
    await member.page.keyboard.press('Escape');
    assert.equal(await openMenu.getAttribute('aria-expanded'), 'false', 'Escape did not close the workspace phone menu');
    assert.ok(await openMenu.evaluate(node => node === document.activeElement), 'Escape did not return focus to the menu button');
    console.log('PASS workspace phone menu: opens, one Sign out, Escape closes it and returns focus');
    await member.page.setViewportSize({ width: 1366, height: 900 });
  }

  report.blocking = blocking;
  report.tracked = tracked;
  report.success = blocking.length === 0;
  if (tracked.length) console.log(`\nTracked in issues (not failing):\n  ${tracked.join('\n  ')}`);
  if (blocking.length) { console.error(`\nFAIL: ${blocking.length} untracked serious or critical findings:\n  ${blocking.join('\n  ')}`); process.exitCode = 1; }
  else console.log(`\nPASS: ${scans.length} scans, no untracked serious or critical findings.`);
} catch (error) {
  report.success = false; report.failure = error.message; console.error(`FAIL: ${error.message}`); process.exitCode = 1;
} finally {
  if (admin) {
    let cleaned = true;
    for (const person of accounts) { const { error } = await admin.auth.admin.deleteUser(person.id); if (error) cleaned = false; }
    report.cleanup = cleaned;
    try { report.remainingAccounts = (await admin.auth.admin.listUsers({ page: 1, perPage: 100 })).data.users.length; } catch { report.remainingAccounts = null; }
    if (!cleaned || report.remainingAccounts !== 0) process.exitCode = 1;
  }
  await browser?.close();
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Results: ${output}`);
}
