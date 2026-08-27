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
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The pages link /site.css and /site.js by root-absolute path, the way they
// resolve on the live site. Under file:// a leading slash means the root of
// the filesystem, so the shared shell would silently fail to load and every
// page would render unstyled. Serve the folder over HTTP instead — closer to
// production, and it costs nothing: node ships the server.
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

let server, origin;

before(async () => {
  server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const abs = join(ROOT, path);
    // Never serve outside the site folder.
    if (!abs.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = readFileSync(abs);
      res.writeHead(200, { 'Content-Type': TYPES[extname(abs)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => { await new Promise((ok) => server?.close(ok)); });

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
  await page.goto(`${origin}/${path}`, { waitUntil: 'load' });
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
    assert.equal(href, 'sms:6098658811');
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
    const expected = '6098658811';
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

describe('the shared shell', () => {
  // Every drift incident so far came from a page being a hand-copy of an older
  // one: a guide shipped without the nav-offset script, another without the
  // Vehicle Guides link, a third without the mobile header rules. /site.css
  // and /site.js exist so the shell lives in one place. These tests make sure
  // pages actually pull from it rather than carrying their own copy again.

  const shellPages = () => htmlFiles().filter((f) =>
    readFileSync(join(ROOT, f), 'utf8').includes('class="sticky-bar"'));

  test('every page with a header links it, rather than copying it', async () => {
    for (const file of shellPages()) {
      const html = readFileSync(join(ROOT, file), 'utf8');
      assert.ok(
        /<link[^>]+href=["']\/site\.css["']/.test(html),
        `${file} has a header but does not link /site.css — it is carrying its ` +
          `own copy of the shell, which is how the last three pages drifted`
      );
      assert.ok(
        /<script[^>]+src=["']\/site\.js["']/.test(html),
        `${file} has a header but does not load /site.js`
      );
    }
  });

  test('no page redefines the brand colours locally', async () => {
    for (const file of shellPages()) {
      const html = readFileSync(join(ROOT, file), 'utf8');
      const own = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
      assert.ok(
        !/--(primary|dark|light|white|text|muted|border)\s*:/.test(own),
        `${file} redefines brand tokens in its own <style>. They belong in ` +
          `/site.css only, or a colour change will reach some pages and not others.`
      );
    }
  });

  test('the shell really arrives — the header is styled, not bare', async () => {
    for (const file of shellPages()) {
      const page = await openPage(file);
      const bg = await page.evaluate(() =>
        getComputedStyle(document.querySelector('.sticky-bar')).backgroundColor);
      await page.close();
      // --dark #3B5166. A bare, unstyled bar would be transparent.
      assert.equal(
        bg, 'rgb(59, 81, 102)',
        `${file}: the header is ${bg}, so /site.css did not load`
      );
    }
  });

  test('the header markup is the same block on every page', async () => {
    // A shared HTML partial needs a build step, and this site has none — it is
    // edited in GitHub Desktop and deployed as-is. So the markup is copied,
    // and the only thing keeping the copies honest is this test. Anything
    // that legitimately differs per page (which nav item is current) is
    // normalised away first.
    const normalise = (block) => block
      .replace(/ aria-current="page"/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    let reference = null, referenceFile = null;
    for (const file of shellPages()) {
      const html = readFileSync(join(ROOT, file), 'utf8');
      const start = html.indexOf('<div class="sticky-bar"');
      const end = html.indexOf('</nav>', html.indexOf('class="subnav-mobile"'));
      const block = normalise(html.slice(start, end));

      if (!reference) { reference = block; referenceFile = file; continue; }
      assert.equal(
        block, reference,
        `${file} has a different header than ${referenceFile}. Copy the block ` +
          `across verbatim — a page that was edited on its own drifted three times.`
      );
    }
  });

  test('no header carries inline styles, which the shared sheet cannot reach', async () => {
    for (const file of shellPages()) {
      const html = readFileSync(join(ROOT, file), 'utf8');
      const header = html.slice(
        html.indexOf('<div class="sticky-bar"'),
        html.indexOf('</nav>', html.indexOf('class="subnav-mobile"'))
      );
      assert.ok(
        !/\sstyle\s*=/.test(header),
        `${file}: the header has a style attribute on it. Inline styles beat ` +
          `/site.css, so the shared sheet would stop being able to change it.`
      );
    }
  });

  test('the desktop nav is the same set of links on every page', async () => {
    let reference = null, referenceFile = null;
    for (const file of shellPages()) {
      const page = await openPage(file);
      const links = await page.evaluate(() =>
        [...document.querySelectorAll('.sticky-nav a')].map((a) =>
          `${a.textContent.trim()} -> ${a.getAttribute('href')}`));
      await page.close();
      if (!links.length) continue;
      if (!reference) { reference = links; referenceFile = file; continue; }
      assert.deepEqual(
        links, reference,
        `${file} has a different nav than ${referenceFile}. A page added later ` +
          `missed a link once already — the nav has to match everywhere.`
      );
    }
  });
});

describe('small text', () => {
  // Terry's captions and card copy were set in a grey that fell below the
  // readable minimum on white. It looked fine on a desktop monitor indoors
  // and thin on a phone in daylight, which is where his customers read it.
  //
  // WCAG asks for 4.5:1 against the background for normal text, 3:1 for large
  // text (24px, or 18.66px when bold).
  test('is dark enough to read against its background', async () => {
    const failures = [];

    for (const file of htmlFiles()) {
      const page = await openPage(file);
      const bad = await page.evaluate(() => {
        const parse = (c) => {
          const n = c.match(/[\d.]+/g).map(Number);
          return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
        };
        // Paint one colour over another, the way the browser does.
        const over = (top, bottom) => ({
          r: top.r * top.a + bottom.r * (1 - top.a),
          g: top.g * top.a + bottom.g * (1 - top.a),
          b: top.b * top.a + bottom.b * (1 - top.a),
          a: 1,
        });
        const luminance = ({ r, g, b }) => {
          const f = (v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (x, y) => {
          const a = luminance(x), b = luminance(y);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };

        // The nearest ancestor that actually paints something.
        const groundUnder = (el) => {
          let ground = { r: 255, g: 255, b: 255, a: 1 };
          const stack = [];
          for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
            const bg = parse(getComputedStyle(n).backgroundColor);
            if (bg.a > 0) stack.push(bg);
            if (bg.a === 1) return stack.reverse().reduce((acc, c) => over(c, acc), ground);
          }
          return stack.reverse().reduce((acc, c) => over(c, acc), ground);
        };

        const found = [];
        for (const el of document.querySelectorAll('body *')) {
          // Only elements holding their own words.
          const text = [...el.childNodes]
            .filter((n) => n.nodeType === 3).map((n) => n.textContent.trim())
            .join(' ').trim();
          if (!text) continue;

          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none') continue;
          if (!el.getClientRects().length) continue;
          // Text sitting on an image is a judgement call, not arithmetic.
          if (style.backgroundImage !== 'none') continue;

          const size = parseFloat(style.fontSize);
          const weight = parseInt(style.fontWeight, 10) || 400;
          const large = size >= 24 || (size >= 18.66 && weight >= 700);
          const need = large ? 3 : 4.5;

          const ground = groundUnder(el);
          const colour = over(parse(style.color), ground);
          const got = ratio(colour, ground);

          if (got < need) {
            found.push({
              text: text.slice(0, 45), got: got.toFixed(2), need,
              size: Math.round(size), colour: style.color,
            });
          }
        }
        return found;
      });
      await page.close();

      for (const f of bad) {
        failures.push(
          `  ${file}  ${f.got}:1 (needs ${f.need}:1)  ${f.size}px ${f.colour}\n` +
          `      "${f.text}"`
        );
      }
    }

    assert.equal(
      failures.length, 0,
      `text that is too faint to read against its background:\n${failures.join('\n')}`
    );
  });
});

describe('the top of every page', () => {
  // The header is position:fixed, so it takes up no room and anything after it
  // slides underneath unless something explicitly clears it. That clearance
  // used to be assembled from three separate numbers on four separate pages;
  // on a 1280px screen they added up to 88px against a 113px header, so the
  // booking page's heading was cut in half. One measured number does it now,
  // and this checks the result at the widths where the header changes shape.
  const WIDTHS = [1280, 1000, 900, 700, 390, 320];

  test('clears the fixed header, at every width', async () => {
    for (const file of htmlFiles()) {
      for (const width of WIDTHS) {
        const page = await openPage(file, { width, height: 800 });
        const result = await page.evaluate(() => {
          const bar = document.querySelector('.sticky-bar');
          if (!bar) return null;
          const first = document.querySelector('.content-container, .hero, .guide-hero');
          if (!first) return null;
          return {
            bar: Math.round(bar.getBoundingClientRect().height),
            top: Math.round(first.getBoundingClientRect().top),
          };
        });
        await page.close();
        if (!result) continue;

        assert.ok(
          result.top >= result.bar,
          `${file} at ${width}px: the page starts at ${result.top}px, under a ` +
            `header ${result.bar}px tall. The top of the content is cut off.`
        );
        // The opposite failure is just as real: a stack of offsets that leaves
        // a band of empty colour the reader has to scroll past.
        assert.ok(
          result.top - result.bar <= 120,
          `${file} at ${width}px: ${result.top - result.bar}px of dead space ` +
            `between the header and the content.`
        );
      }
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
