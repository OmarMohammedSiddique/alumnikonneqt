// Bounded load test of POST /api/match against NFR-01 (95% of responses within 2 seconds
// at 100 concurrent requests). Local targets only.
// node --env-file=.env.local scripts/load-test-match.mjs [accounts] [concurrency] [rounds] [samples-file]
// Disposable fictional Mentee accounts are created, given an embedding through POST /api/embed,
// used for the test and deleted afterwards. Failed requests are counted, never left out.
// When a samples file is named, every request is written to it (round, status, milliseconds,
// matches, error name) so the summary can be recomputed. It holds no ids or addresses.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const appUrl = new URL(process.env.LOAD_TEST_APP_URL ?? "http://localhost:3000");
const dbUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
for (const url of [appUrl, dbUrl]) {
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Local targets only");
  assert.equal(url.protocol, "http:");
}
const accounts = Number(process.argv[2] ?? 25);
const concurrency = Number(process.argv[3] ?? 100);
const rounds = Number(process.argv[4] ?? 5);
const samplesFile = process.argv[5];
const bounded = (value, max) => Number.isInteger(value) && value >= 1 && value <= max;
assert.ok(bounded(accounts, 100), "accounts must be a whole number from 1 to 100");
assert.ok(bounded(concurrency, 200), "concurrency must be a whole number from 1 to 200");
assert.ok(bounded(rounds, 20), "rounds must be a whole number from 1 to 20");
const thresholdMs = 2000;
const requestTimeoutMs = 30_000;
const admin = createClient(dbUrl.href, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const percentile = (values, share) =>
  [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * share) - 1)];
const users = [];
const sessions = [];

let cleaned = false;
async function cleanUp() {
  if (cleaned) return;
  cleaned = true;
  const left = [];
  for (const id of [...users].reverse()) {
    try {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) left.push(id);
    } catch {
      left.push(id);
    }
  }
  console.log(`Deleted ${users.length - left.length} of ${users.length} disposable load-test accounts`);
  if (left.length) {
    console.error(`Not deleted, remove by hand: ${left.join(", ")}`);
    process.exitCode = 1;
  }
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    console.error(`${signal} received, cleaning up`);
    await cleanUp();
    process.exit(1);
  });
}

async function match(headers, round) {
  const started = performance.now();
  try {
    const response = await fetch(new URL("/api/match", appUrl), { method: "POST", headers,
      signal: AbortSignal.timeout(requestTimeoutMs) });
    const body = await response.json().catch(() => ({}));
    // A 200 without a matches array is not a usable answer, so it is recorded as a failure.
    const usable = response.status === 200 && Array.isArray(body.matches);
    return { round, status: response.status, ok: usable, ms: performance.now() - started,
      matches: usable ? body.matches.length : null };
  } catch (reason) {
    return { round, status: 0, ok: false, ms: performance.now() - started, matches: null, error: reason.name };
  }
}

try {
  for (let index = 0; index < accounts; index++) {
    const email = `load-${randomUUID()}@example.test`;
    const password = `${randomUUID()}Aa1!`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { role: "mentee", full_name: `Load Test ${index}` },
      // Marked fictional like the seeded Mentors, so matching keeps the same candidate pool (#109).
      app_metadata: { fictional: true, fixture: "alumnikonneqt-load-test" } });
    assert.ok(!created.error, created.error?.message);
    users.push(created.data.user.id);
    const updated = await admin.from("profiles").update({ headline: "Graduate looking for logistics and aviation guidance",
      bio: "I want to learn how freight planning and aircraft maintenance scheduling work in practice.",
      skills: ["Planning", "Spreadsheets"], industry: "Logistics" }).eq("id", created.data.user.id);
    assert.ok(!updated.error, updated.error?.message);
    const cookies = new Map();
    const sdk = createServerClient(dbUrl.href, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)) },
      auth: { autoRefreshToken: false },
    });
    const signedIn = await sdk.auth.signInWithPassword({ email, password });
    assert.ok(!signedIn.error, signedIn.error?.message);
    const headers = { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") };
    const embedded = await fetch(new URL("/api/embed", appUrl), { method: "POST", headers,
      signal: AbortSignal.timeout(120_000) });
    assert.equal(embedded.status, 200, `embed returned ${embedded.status}`);
    sessions.push(headers);
  }
  const mentors = await admin.from("profiles").select("id", { count: "exact", head: true })
    .eq("role", "mentor").not("embedding", "is", null);
  assert.ok(!mentors.error, mentors.error?.message);
  const warm = [];
  for (const headers of sessions) warm.push(await match(headers, 0));
  assert.ok(warm.every((sample) => sample.ok), "warm-up request failed");

  const samples = [];
  const roundWallMs = [];
  for (let round = 1; round <= rounds; round++) {
    const started = performance.now();
    const results = await Promise.all(Array.from({ length: concurrency }, (_, index) =>
      match(sessions[index % sessions.length], round)));
    roundWallMs.push(Math.round(performance.now() - started));
    samples.push(...results);
  }
  const all = samples.map((sample) => sample.ms);
  const ok = samples.filter((sample) => sample.ok);
  const within = ok.filter((sample) => sample.ms <= thresholdMs).length;
  const statuses = {};
  for (const sample of samples) statuses[sample.status] = (statuses[sample.status] ?? 0) + 1;
  const counts = ok.map((sample) => sample.matches);
  const whole = (value) => Math.round(value);
  let commit = "unknown";
  try {
    commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    // not a git checkout
  }
  if (samplesFile) {
    writeFileSync(samplesFile, `${JSON.stringify([...warm, ...samples].map((sample) =>
      ({ ...sample, ms: Number(sample.ms.toFixed(1)) })))}\n`);
  }
  console.log(JSON.stringify({
    run_at: new Date().toISOString(), commit, node: process.version, request_timeout_ms: requestTimeoutMs,
    target: appUrl.origin, accounts, concurrency, rounds, requests: samples.length,
    mentors_with_embedding: mentors.count,
    statuses, successful_with_matches_array: ok.length,
    matches_per_successful_response: counts.length ? { min: Math.min(...counts), max: Math.max(...counts) } : null,
    within_2s_and_successful: within, share_within_2s: Number((within / samples.length).toFixed(4)),
    latency_ms_all_requests: { min: whole(Math.min(...all)), median: whole(percentile(all, 0.5)), p90: whole(percentile(all, 0.9)),
      p95: whole(percentile(all, 0.95)), p99: whole(percentile(all, 0.99)), max: whole(Math.max(...all)) },
    sequential_warm_up_ms: { median: whole(percentile(warm.map((s) => s.ms), 0.5)), max: whole(Math.max(...warm.map((s) => s.ms))) },
    round_wall_ms: roundWallMs,
    samples_file: samplesFile ?? null,
    nfr_01_met: within / samples.length >= 0.95,
  }, null, 1));
} finally {
  await cleanUp();
}
