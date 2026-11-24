// Issue #155: regenerate the README landing page screenshot and walkthrough GIF.
//
// Usage: node scripts/capture-readme-preview.mjs [base URL]
// The base URL defaults to the live site. Pass http://localhost:3000 to capture
// a local server instead. Needs ffmpeg on the PATH. Set KEEP_FRAMES to a folder
// path to keep the individual frames there for inspection.
//
// The visit stores a "reject non-essential" cookie choice before the page loads,
// so the banner stays out of frame and no analytics are sent.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = (process.argv[2] ?? 'https://alumnikonneqt.com').replace(/\/$/, '');
const outDir = fileURLToPath(new URL('../docs/images/', import.meta.url));
const GIF_WIDTH = 880;
const framesDir = mkdtempSync(path.join(tmpdir(), 'akq-readme-preview-'));
// Both outputs are built in the temporary folder and copied over the README
// images together, so a failed run never leaves a new still beside an old GIF.
const outputs = {
  still: { built: path.join(framesDir, 'readme-landing.jpg'), final: path.join(outDir, 'readme-landing.jpg') },
  gif: { built: path.join(framesDir, 'readme-walkthrough.gif'), final: path.join(outDir, 'readme-walkthrough.gif') },
};

const consent = JSON.stringify({
  version: 1,
  timestamp: new Date().toISOString(),
  preferences: { necessary: true, functional: false, analytics: false },
});

const frames = [];
let browser;

try {
  // Fail before visiting the site if ffmpeg is missing.
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  mkdirSync(outDir, { recursive: true });
  // Prefer Playwright's own Chromium; fall back to an installed Google Chrome.
  browser = await chromium.launch({ headless: true }).catch(bundledError =>
    chromium.launch({ headless: true, channel: 'chrome' }).catch(chromeError => {
      throw new AggregateError([bundledError, chromeError], 'Could not launch Playwright Chromium or Google Chrome');
    }),
  );
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  });
  await context.addInitScript(value => {
    try {
      localStorage.setItem('alumnikonneqt-cookie-consent', value);
    } catch {
      // Storage blocked: the banner may show, which is acceptable for a capture.
    }
  }, consent);
  const page = await context.newPage();

  const snap = async (seconds, label) => {
    const file = path.join(framesDir, `frame-${String(frames.length).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    frames.push({ file, seconds, label });
    return file;
  };

  // Scroll so a section starts just under the sticky navigation bar, then let
  // its reveal animation finish before the frame is taken.
  const showSection = async selector => {
    await page.evaluate(sel => {
      const target = document.querySelector(sel);
      if (!target) throw new Error(`Missing section ${sel}`);
      const header = document.querySelector('header');
      const offset = header ? header.getBoundingClientRect().height : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - offset - 24;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'instant' });
    }, selector);
    await page.waitForTimeout(1100);
  };

  // 1. Cabin intro: logo preload, the cabin with its split-flap hint, the shade.
  await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
  await page.locator('[data-cabin-intro]').waitFor();
  await page.waitForTimeout(700);
  await snap(0.9, 'preload logo');
  await page.locator('[data-cabin-intro][data-phase="cabin"]').waitFor();
  await page.waitForFunction(
    () => document.querySelector('[data-cabin-intro] button span')?.textContent?.trim() === 'Please lower your window shade',
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(300);
  await snap(1.8, 'cabin seat');
  await page.getByRole('button', { name: 'Please lower your window shade' }).click();
  await page.waitForTimeout(200);
  await snap(0.5, 'shade lowering');

  // 2. Hero over the clouds, also saved as the README still.
  await page.locator('[data-cabin-intro]').waitFor({ state: 'detached', timeout: 10_000 });
  await page.waitForTimeout(1400);
  const heroFrame = await snap(2.4, 'hero');

  // 3. The main landing page sections.
  await showSection('#how-it-works');
  await snap(1.8, 'how it works');
  await showSection('#community');
  await snap(1.8, 'community');
  await showSection('#matching');
  await snap(1.8, 'matching');
  // The FAQs reach the bottom of the page, so one frame covers them, the
  // closing invitation and the footer.
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(1100);
  await snap(2.4, 'faqs, join and footer');

  // README still: high quality JPEG of the hero.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', heroFrame, '-q:v', '3', outputs.still.built]);

  // Walkthrough GIF: one shared palette, per-frame hold times, endless loop.
  const list = path.join(framesDir, 'frames.txt');
  writeFileSync(
    list,
    frames.map(frame => `file '${frame.file}'\nduration ${frame.seconds}`).join('\n') +
      `\nfile '${frames.at(-1).file}'\n`,
  );
  const palette = path.join(framesDir, 'palette.png');
  const scale = `scale=${GIF_WIDTH}:-1:flags=lanczos`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `${scale},palettegen=max_colors=192:stats_mode=full`, palette]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', palette,
    '-lavfi', `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4`, '-loop', '0', outputs.gif.built]);

  for (const output of Object.values(outputs)) copyFileSync(output.built, output.final);

  if (process.env.KEEP_FRAMES) {
    mkdirSync(process.env.KEEP_FRAMES, { recursive: true });
    for (const frame of frames) copyFileSync(frame.file, path.join(process.env.KEEP_FRAMES, path.basename(frame.file)));
  }

  const kb = file => `${Math.round(statSync(file).size / 1024)} KB`;
  console.log(`Captured ${frames.length} frames from ${baseUrl}`);
  for (const { final } of Object.values(outputs)) console.log(`Saved ${path.relative(process.cwd(), final)} (${kb(final)})`);
} finally {
  await browser?.close();
  rmSync(framesDir, { recursive: true, force: true });
}
