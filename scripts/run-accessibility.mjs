// Issue #146: owns a separate disposable Supabase stack for the full
// accessibility run (public pages plus the signed-in workspace), following the
// cold-start runner. Never resets the shared local stack. Needs Docker, so it
// runs in CI; do not run it on a machine whose database lives elsewhere.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const work = mkdtempSync(path.join(tmpdir(), 'alumni-accessibility-'));
const stack = 'alumni-accessibility';
const appOrigin = 'http://127.0.0.1:3155';
const output = path.resolve(process.env.A11Y_RESULTS ?? '/tmp/accessibility-results.json');
const logPath = path.join(work, 'execution.log');
writeFileSync(logPath, '', { mode: 0o600 });
let server, started = false;
function command(binary, args, options = {}) {
  const r = spawnSync(binary, args, { cwd: root, encoding: 'utf8', timeout: 900_000, ...options });
  appendFileSync(logPath, `[${binary} ${args[0]}]\n${r.stdout ?? ''}${r.stderr ?? ''}\n`);
  // Supabase status/start output contains local keys. Keep full output private.
  if (r.status !== 0) throw Error(`Accessibility setup command failed: ${binary} ${args[0]}. Inspect private local execution logs.`);
  return r.stdout;
}
try {
  const existing = spawnSync('docker', ['inspect', `supabase_db_${stack}`], { encoding: 'utf8' });
  assert.notEqual(existing.status, 0, 'Dedicated accessibility container already exists. Stop that exact test project before rerunning; shared containers are never reset.');
  mkdirSync(path.join(work, 'supabase'));
  let config = readFileSync(path.join(root, 'supabase/config.toml'), 'utf8').replace('project_id = "alumniconnect"', `project_id = "${stack}"`);
  for (const [from, to] of [['54321', '56421'], ['54322', '56422'], ['54320', '56420'], ['54323', '56423'], ['54324', '56424'], ['54327', '56427'], ['54329', '56429']]) config = config.replaceAll(from, to);
  for (const section of ['auth.external.google', 'analytics', 'realtime', 'db.seed']) {
    const escaped = section.replaceAll('.', '\\.');
    config = config.replace(new RegExp(`(\\[${escaped}\\]\\s*\\n)(.*?)(?=\\n\\[|$)`, 's'), (_all, heading, body) => heading + body.replace('enabled = true', 'enabled = false'));
  }
  config = config.replace('site_url = "http://127.0.0.1:3000"', `site_url = "${appOrigin}"`);
  writeFileSync(path.join(work, 'supabase/config.toml'), config);
  for (const folder of ['migrations', 'templates']) cpSync(path.join(root, 'supabase', folder), path.join(work, 'supabase', folder), { recursive: true });
  console.log('Starting isolated local accessibility database.');
  started = true;
  command('npx', ['supabase', 'start', '--workdir', work, '-x', 'studio,imgproxy,edge-runtime,analytics,vector,realtime,meta,storage']);
  const status = JSON.parse(command('npx', ['supabase', 'status', '--workdir', work, '-o', 'json']));
  assert.equal(new URL(status.API_URL).port, '56421');
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    EMAIL_DELIVERY_MODE: 'suppress', RESEND_API_KEY: '', SITE_URL: appOrigin, ACCOUNT_EMAIL_ENABLED: 'false', EMAIL_OTP_ENABLED: 'false',
    A11Y_SCOPE: 'all', A11Y_APP_URL: appOrigin, A11Y_RESULTS: output, A11Y_SOURCE: command('git', ['rev-parse', 'HEAD']).trim() };
  console.log('Building the app for the isolated stack.');
  command(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], { env });
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', new URL(appOrigin).port], { cwd: root, env, stdio: ['ignore', 'ignore', 'ignore'] });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error('Isolated app exited before readiness');
    try { if ((await fetch(appOrigin, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const test = spawn(process.execPath, ['scripts/verify-accessibility.mjs'], { cwd: root, env, stdio: 'inherit' });
  const [code] = await once(test, 'exit'); assert.equal(code, 0, 'Accessibility verification failed; the results file lists each finding');
} catch (error) {
  console.error(`FAIL: ${error.message}`); process.exitCode = 1;
} finally {
  if (server) { server.kill('SIGTERM'); await once(server, 'exit').catch(() => {}); }
  if (started) {
    const stopped = spawnSync('npx', ['supabase', 'stop', '--workdir', work, '--no-backup'], { cwd: root, encoding: 'utf8', timeout: 120000 });
    if (stopped.status !== 0) process.exitCode = 1;
  }
  console.log('Dedicated accessibility stack stopped. Rebuild normally before using next start; the isolated build replaces .next.');
}
