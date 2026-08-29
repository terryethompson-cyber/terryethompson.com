/**
 * Conversion-path tests.
 *
 * These drive a real browser through the things a customer actually does on
 * the site — pasting a vehicle link, tapping to text, booking a time — and
 * check the outcome, not the appearance.
 *
 * The link checker proves a page exists. These prove its buttons work.
 *
 * Run with:  npm run test:browser
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = (p) => `file://${join(ROOT, p)}`;

// Locally this environment ships a browser at a fixed path; in CI Playwright
// installs its own and finds it without help.
const launchOptions = process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
  : {};

let browser;
before(async () => { browser = await chromium.launch(launchOptions); });
after(async () => { await browser?.close(); });

const openPage = async (path, viewport = { width: 1280, height: 900 }) => {
  const page = await browser.newPage({ viewport });
  await page.goto(site(path));
  return page;
};

function htmlFiles(absDir = ROOT, found = []) {
  for (const entry of readdirSync(absDir)) {
    if (['.git', 'node_modules', '.github', 'tests'].includes(entry)) continue;
    const abs = join(absDir, entry);
    if (statSync(abs).isDirectory()) htmlFiles(abs, found);
    else if (entry.endsWith('.html')) found.push(relative(ROOT, abs).split('\\').join('/'));
  }
  return found;
}

// ---------------------------------------------------------------------------

describe('the vehicle link box on the home page', () => {
  test('carries the pasted link into the text message', async () => {
    const page = await openPage('index.html');
    const vehicle = 'https://www.westherr.com/inventory/2026-chevrolet-tahoe-xyz123';

    await page.fill('.hook-input', vehicle);

    const href = await page.getAttribute('.hook-send', 'href');
    assert.ok(
      href.includes(encodeURIComponent(vehicle)),
      `the pasted link is not in the text message.\n  send link: ${href}`
    );
    assert.ok(href.startsWith('sms:'), 'send button should still be an sms: link');
    await page.close();
  });

  test('uses a body separator both iPhone and Android accept', async () => {
    const page = await openPage('index.html');
    await page.fill('.hook-input', 'https://example.com/car');
    const href = await page.getAttribute('.hook-send', 'href');
    // "?&" is the one form that works on both platforms.
    assert.ok(href.includes('?&body='), `expected "?&body=" in: ${href}`);
    await page.close();
  });

  test('still opens a blank message when nothing is pasted', async () => {
    const page = await openPage('index.html');
    const href = await page.getAttribute('.hook-send', 'href');
    assert.equal(href, 'sms:7169324793');
    await page.close();
  });

  test('pressing Enter sends rather than doing nothing', async () => {
    const page = await openPage('index.html');
    await page.fill('.hook-input', 'https://example.com/truck');
    await page.press('.hook-input', 'Enter');
    const href = await page.getAttribute('.hook-send', 'href');
    assert.ok(href.includes(encodeURIComponent('https://example.com/truck')));
    await page.close();
  });

  test('the box is reachable and labelled for screen readers', async () => {
    const page = await openPage('index.html');
    const label = await page.getAttribute('.hook-input', 'aria-label');
    assert.ok(label && label.length > 0, 'the input needs an aria-label');
    await page.close();
  });
});

describe('booking a time', () => {
  test('the calendar is embedded and points at Google Calendar', async () => {
    const page = await openPage('appointment.html');
    const src = await page.getAttribute('iframe', 'src');
    assert.ok(src, 'the appointment page has no calendar embed');
    assert.ok(
      src.startsWith('https://calendar.google.com/'),
      `calendar embed points somewhere unexpected: ${src}`
    );
    await page.close();
  });
});

describe('contact links', () => {
  test('every call and text link is the same working number', async () => {
    const expected = '7169324793';
    for (const file of htmlFiles()) {
      const html = readFileSync(join(ROOT, file), 'utf8');
      // Only real links — not the "sms:" string literals inside page scripts.
      for (const m of html.matchAll(/href\s*=\s*["'](?:tel|sms):([^"'?&]+)/g)) {
        const digits = m[1].replace(/\D/g, '');
        assert.equal(
          digits, expected,
          `${file} has a contact link for ${digits}, expected ${expected}`
        );
      }
    }
  });
});

describe('the header on a phone', () => {
  // A new vehicle guide shipped without the mobile header rules and its header
  // was back to 157px with the tagline on five lines. Nothing caught it, so
  // this does.
  test('does not grow tall enough to eat the screen', async () => {
    const LIMIT = 150; // px. Pages sit at 105-141px with the rules applied.
    for (const file of htmlFiles()) {
      const page = await openPage(file, { width: 360, height: 780 });
      const result = await page.evaluate(() => {
        const bar = document.querySelector('.sticky-bar');
        if (!bar) return null;
        const tagline = document.querySelector('.utility-tagline');
        const lineHeight = tagline
          ? parseFloat(getComputedStyle(tagline).lineHeight) || 20
          : 0;
        return {
          height: Math.round(bar.getBoundingClientRect().height),
          taglineLines: tagline
            ? Math.round(tagline.getBoundingClientRect().height / lineHeight)
            : 0,
        };
      });
      await page.close();
      if (!result) continue;

      assert.ok(
        result.height <= LIMIT,
        `${file}: the fixed header is ${result.height}px on a 360px phone ` +
          `(limit ${LIMIT}px). It is probably missing the mobile header rules.`
      );
      assert.ok(
        result.taglineLines <= 1,
        `${file}: the tagline wraps to ${result.taglineLines} lines on a phone`
      );
    }
  });
});

describe('the menu on a phone', () => {
  test('is not hidden behind the sticky header', async () => {
    for (const file of htmlFiles()) {
      const page = await openPage(file, { width: 390, height: 844 });
      const result = await page.evaluate(() => {
        const bar = document.querySelector('.sticky-bar');
        const subnav = document.querySelector('.subnav-mobile');
        if (!bar || !subnav) return null;
        if (getComputedStyle(subnav).display === 'none') return null;
        const b = bar.getBoundingClientRect(), s = subnav.getBoundingClientRect();
        return { barBottom: Math.round(b.bottom), subTop: Math.round(s.top) };
      });
      await page.close();
      if (!result) continue;
      assert.ok(
        result.subTop >= result.barBottom,
        `${file}: the menu sits at ${result.subTop}px, behind a header ending ` +
          `at ${result.barBottom}px — it is invisible on a phone`
      );
    }
  });
});
