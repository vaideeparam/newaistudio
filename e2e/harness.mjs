// Shared set-up for the user-journey tests: one browser, the built single-file
// preview wrapped in the same page skeleton claude.ai adds, and helpers to
// open a route at phone or desktop size.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// Playwright comes from the machine (CI installs it with `npm i -D playwright`).
const { chromium, devices } = require('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demo = resolve(root, 'dist-demo/ai-studio-demo.html');
const page = resolve(root, 'dist-demo/e2e.html');
export const SHOTS = process.env.E2E_SHOTS ?? resolve(root, 'e2e/screens');

export const SIZES = {
  phone: { ...devices['iPhone 13'] },
  desktop: { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 },
};

let browser;
export async function setup() {
  if (!existsSync(demo)) throw new Error('Run `npm run build:demo` first.');
  writeFileSync(
    page,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${readFileSync(demo, 'utf8')}</body></html>`,
  );
  mkdirSync(SHOTS, { recursive: true });
  browser = await chromium.launch();
}
export async function teardown() {
  await browser?.close();
}

/** Opens the app at a route, at a size. Fails the test on any page error. */
export async function open(size, route = '/', { storage } = {}) {
  const ctx = await browser.newContext(SIZES[size]);
  if (storage) await ctx.addInitScript((s) => localStorage.setItem('studio.conversations.v1', s), storage);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`file://${page}#${route}`);
  await p.waitForLoadState('networkidle').catch(() => undefined);
  p.errors = errors;
  p.size = size;
  p.ctx = ctx;
  return p;
}

export async function shot(p, name) {
  await p.screenshot({ path: resolve(SHOTS, `${p.size}-${name}.png`) });
}

/** Width of the page's horizontal overflow, in CSS pixels (0 = none). */
export const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** The stored conversations, to carry them into a fresh page (a reload). */
export const stored = (p) => p.evaluate(() => localStorage.getItem('studio.conversations.v1'));
