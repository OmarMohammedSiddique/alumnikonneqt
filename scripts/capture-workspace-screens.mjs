// Issue #160: capture every signed-in workspace page for before and after
// comparisons of the workspace restyle.
//
// Usage: node --env-file=.env.local scripts/capture-workspace-screens.mjs <out dir> [base URL]
//
// Local only. The base URL and the Supabase URL must both be loopback
// addresses, because the script signs in with the service-role key. It signs in
// through a one-time magic link token, so no passwords are typed or stored, as:
//   - the fictional Mentee and Mentor from scripts/seed-dev.mjs, and
//   - admin@seed.local, a local administrator that seed-dev does not create:
//     create that account yourself and set its profile role to admin.
// Each page is captured at 390 and 1440 pixels wide in light and dark mode as a
// JPEG. Set ONLY to a comma separated list of name fragments to capture fewer.
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { chromium } from 'playwright';

const [outArg, baseArg = 'http://127.0.0.1:3160'] = process.argv.slice(2);
if (!outArg) throw new Error('Pass an output folder');
const baseUrl = baseArg.replace(/\/$/, '');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const loopback = url => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname);
if (!loopback(baseUrl) || !loopback(supabaseUrl)) throw new Error('Local loopback URLs only');

const outDir = path.resolve(outArg);
mkdirSync(outDir, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Session cookies exactly as the app's own Supabase SSR client writes them.
async function sessionCookies(email) {
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  if (!list.users.some(user => user.email === email)) throw new Error(`Local account ${email} is missing; see the notes at the top of this script`);
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const jar = new Map();
  const client = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: list => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error: verifyError } = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
  if (verifyError) throw verifyError;
  const host = new URL(baseUrl).hostname;
  // The presenter cookie that /demo sets after the local key is entered, so the
  // demo switcher bar shows for the fictional seed accounts.
  const key = process.env.DEMO_SWITCHER_KEY;
  if (key) jar.set('ak-demo-presenter', createHash('sha256').update(`presenter:${key}`).digest('hex'));
  return [...jar].map(([name, value]) => ({ name, value, domain: host, path: '/', httpOnly: false, sameSite: 'Lax' }));
}

const SHOTS = [
  { account: 'explorer.mentee@seed.local', who: 'mentee', pages: [
    // The comparison request is held open, so the loading state stays on screen
    // and no model run is spent on this frame.
    { slug: 'discover-loading', path: '/discover', hold: '**/api/match/compare', ready: page => page.getByText('Running both models on your saved profile').first().waitFor() },
    { slug: 'discover-compare', path: '/discover', ready: page => page.getByText(/Showing up to five results per model|No visible mentors|took too long|Could not compare|Please wait|busy/).first().waitFor({ timeout: 90_000 }) },
    { slug: 'discover-recommended-list', path: '/discover', ready: async page => {
      await page.getByRole('button', { name: 'Recommended' }).click();
      await page.getByRole('button', { name: 'List' }).click();
      await page.locator('[role="article"]').first().waitFor({ timeout: 60_000 });
    } },
    { slug: 'profile', path: '/profile' },
    { slug: 'profile-photo', path: '/profile/photo' },
    { slug: 'profile-email-preferences', path: '/profile/email-preferences' },
    { slug: 'requests', path: '/requests' },
  ] },
  { account: 'grace.mentor@seed.local', who: 'mentor', pages: [
    { slug: 'requests', path: '/requests' },
  ] },
  { account: 'admin@seed.local', who: 'admin', pages: [
    { slug: 'admin', path: '/admin' },
    { slug: 'discover-empty', path: '/discover', ready: async page => {
      await page.getByText(/before comparing models|Please wait|Could not/).first().waitFor({ timeout: 90_000 });
      await page.getByRole('button', { name: 'Recommended' }).click();
      await page.getByText(/Start with your career direction|Help Mentees understand|Could not/).first().waitFor({ timeout: 60_000 });
    } },
    { slug: 'requests-empty', path: '/requests' },
  ] },
];

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
];

// The comparison endpoint allows three runs a minute per account.
const compareRuns = new Map();
async function respectCompareLimit(account) {
  const runs = (compareRuns.get(account) ?? []).filter(time => Date.now() - time < 62_000);
  if (runs.length >= 3) await new Promise(resolve => setTimeout(resolve, 62_000 - (Date.now() - runs[0])));
  compareRuns.set(account, [...runs.filter(time => Date.now() - time < 62_000), Date.now()]);
}

const browser = await chromium.launch({ headless: true }).catch(() => chromium.launch({ headless: true, channel: 'chrome' }));
const overflow = [];
try {
  for (const group of SHOTS) {
    const cookies = await sessionCookies(group.account);
    for (const theme of ['light', 'dark']) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          colorScheme: theme,
          reducedMotion: 'reduce',
        });
        await context.addCookies(cookies);
        await context.addInitScript(({ theme }) => {
          try {
            localStorage.setItem('alumnikonneqt-cookie-consent', JSON.stringify({
              version: 1, timestamp: new Date().toISOString(),
              preferences: { necessary: true, functional: true, analytics: false },
            }));
            localStorage.setItem('alumnikonneqt-theme', theme);
          } catch { /* storage blocked */ }
          // Keep the Next.js development badge out of the frames.
          document.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style');
            style.textContent = 'nextjs-portal { display: none !important; }';
            document.head.append(style);
          });
        }, { theme });
        const page = await context.newPage();
        for (const shot of group.pages) {
          const name = `${group.who}-${shot.slug}-${viewport.name}-${theme}`;
          if (only && !only.some(o => name.includes(o))) continue;
          if (shot.hold) await page.route(shot.hold, () => {});
          else if (shot.path === '/discover') await respectCompareLimit(group.account);
          await page.goto(`${baseUrl}${shot.path}`, { waitUntil: 'domcontentloaded' });
          await page.locator('#workspace').waitFor();
          if (shot.ready) await shot.ready(page);
          else await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(600);
          const width = await page.evaluate(() => document.documentElement.scrollWidth);
          if (width > viewport.width) overflow.push(`${name}: ${width}px`);
          await page.screenshot({ path: path.join(outDir, `${name}.jpg`), fullPage: true, type: 'jpeg', quality: 62 });
          if (shot.hold) await page.unrouteAll({ behavior: 'ignoreErrors' });
          console.log('captured', name);
        }
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
console.log(overflow.length ? `Horizontal overflow:\n${overflow.join('\n')}` : 'No horizontal overflow.');
