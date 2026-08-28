#!/usr/bin/env node
/**
 * Page quality checks.
 *
 * Where check-links.mjs asks "does this link go anywhere", this asks
 * "is this page fit to be shared, found and loaded quickly".
 *
 * Run it with:  npm run test:pages
 *
 * No dependencies. Plain Node.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sitemapUrls, renderSitemap, NOT_PAGES, urlFor } from './build-sitemap.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** The one phone number and business name, as they must appear everywhere. */
const PHONE_DIGITS = '6098658811';
const BUSINESS = 'West Herr Chevrolet of Williamsville';

/** An unreferenced file bigger than this is dead weight worth knowing about. */
const UNUSED_ASSET_LIMIT = 500 * 1024;

/** Any single image bigger than this will be felt on a phone. */
const IMAGE_LIMIT = 800 * 1024;

const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'tests']);
const ASSET_TYPES = /\.(jpg|jpeg|png|gif|webp|avif|svg|pdf|mp4|webm|woff2?)$/i;

// ---------------------------------------------------------------------------

const errors = [];
const warnings = [];
const err = (file, title, detail) => errors.push({ file, title, detail });
const warn = (file, title, detail) => warnings.push({ file, title, detail });

function walk(absDir = ROOT, found = []) {
  for (const entry of readdirSync(absDir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const abs = join(absDir, entry);
    if (statSync(abs).isDirectory()) walk(abs, found);
    else found.push(relative(ROOT, abs).split('\\').join('/'));
  }
  return found;
}

const allFiles = walk();
const pages = allFiles.filter((f) => f.endsWith('.html'));
const visitablePages = pages.filter((p) => !NOT_PAGES.has(p));

const sourceOf = new Map(pages.map((p) => [p, readFileSync(join(ROOT, p), 'utf8')]));

const has = (html, re) => re.test(html);
const attr = (html, re) => html.match(re)?.[1];

// ---------------------------------------------------------------------------
// 1. Every page says what it is
// ---------------------------------------------------------------------------

const REQUIRED = [
  ['a language', /<html[^>]+lang=/i],
  ['a mobile viewport', /<meta[^>]+name=["']viewport["']/i],
  ['a character set', /<meta[^>]+charset=/i],
  ['a title', /<title>[^<]{5,}<\/title>/i],
  ['a description for search results', /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{50,}["']/i],
  ['a canonical address', /<link[^>]+rel=["']canonical["']/i],
  ['a tab icon', /<link[^>]+rel=["'](?:icon|shortcut icon)["']/i],
];

/** These are what produce a preview card when a link is texted or shared. */
const SHARE_TAGS = [
  ['og:title', /<meta[^>]+property=["']og:title["']/i],
  ['og:description', /<meta[^>]+property=["']og:description["']/i],
  ['og:image', /<meta[^>]+property=["']og:image["']/i],
  ['og:url', /<meta[^>]+property=["']og:url["']/i],
  ['twitter:card', /<meta[^>]+name=["']twitter:card["']/i],
];

for (const page of visitablePages) {
  const html = sourceOf.get(page);

  for (const [what, re] of REQUIRED) {
    if (!has(html, re)) err(page, `Page is missing ${what}`, 'Search engines and phones rely on it.');
  }

  const missingShare = SHARE_TAGS.filter(([, re]) => !has(html, re)).map(([n]) => n);
  if (missingShare.length > 0) {
    err(
      page,
      'Link previews will not work',
      `Missing ${missingShare.join(', ')}. Texting this link shows a bare web address ` +
        'with no title or picture.'
    );
  }

  // The Call and Text buttons must be on every page. They are the point of
  // the site: whatever page a customer lands on, reaching Terry is one tap.
  const hasCall = /class=["'][^"']*\bbtn-call\b[^"']*["']/.test(html);
  const hasText = /class=["'][^"']*\bbtn-text\b[^"']*["']/.test(html);
  if (!hasCall || !hasText) {
    const missing = [!hasCall && 'Call Terry', !hasText && 'Text Terry'].filter(Boolean);
    err(
      page,
      `Page is missing the ${missing.join(' and ')} button${missing.length > 1 ? 's' : ''}`,
      'Every page needs the .btn-call (tel:) and .btn-text (sms:) links in the ' +
        'header, top right. A customer should never have to hunt for the phone number.'
    );
  }

  // Accessibility floor.
  const h1s = html.match(/<h1[\s>]/gi) ?? [];
  if (h1s.length === 0) err(page, 'Page has no main heading', 'Every page needs exactly one <h1>.');
  if (h1s.length > 1) warn(page, `Page has ${h1s.length} main headings`, 'Exactly one <h1> reads best.');

  for (const img of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt\s*=/i.test(img[0])) {
      err(page, 'Image has no alt text', img[0].slice(0, 90));
    }
  }

  // The share picture must be a full address or it will not load for anyone.
  const ogImage = attr(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImage && !/^https?:\/\//i.test(ogImage)) {
    err(page, 'Share picture uses a relative address', `og:image is "${ogImage}" — needs the full https:// address.`);
  }

  // Canonical should match where the page actually lives.
  const canonical = attr(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (canonical && canonical !== urlFor(page)) {
    err(page, 'Canonical address does not match the page', `says "${canonical}", should be "${urlFor(page)}"`);
  }
}

// ---------------------------------------------------------------------------
// 2. The same phone number and business name everywhere
// ---------------------------------------------------------------------------

for (const page of pages) {
  const html = sourceOf.get(page);

  for (const m of html.matchAll(/href\s*=\s*["'](?:tel|sms):([^"'?&]+)/gi)) {
    const digits = m[1].replace(/\D/g, '');
    if (digits !== PHONE_DIGITS) {
      err(page, 'Wrong phone number', `found ${digits}, expected ${PHONE_DIGITS}`);
    }
  }

  for (const m of html.matchAll(/West Herr Chevrolet(?: of ([A-Za-z]+))?/g)) {
    if (m[0] !== BUSINESS) {
      warn(page, 'Business name written differently', `"${m[0]}" — Google local search rewards it being identical everywhere.`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The sitemap matches reality
// ---------------------------------------------------------------------------

const sitemapPath = join(ROOT, 'sitemap.xml');
let sitemapOnDisk = null;
try { sitemapOnDisk = readFileSync(sitemapPath, 'utf8'); } catch {}

if (sitemapOnDisk === null) {
  err('sitemap.xml', 'No sitemap', 'Run: npm run sitemap');
} else if (sitemapOnDisk !== renderSitemap(sitemapUrls())) {
  err('sitemap.xml', 'Sitemap is out of date', 'A page was added or renamed. Run: npm run sitemap');
}

try { readFileSync(join(ROOT, 'robots.txt'), 'utf8'); }
catch { err('robots.txt', 'No robots.txt', 'Search engines look for it, and it points them at the sitemap.'); }

// ---------------------------------------------------------------------------
// 4. Nothing heavy that nobody uses
// ---------------------------------------------------------------------------

const allHtml = pages.map((p) => sourceOf.get(p)).join('\n');
const referenced = new Set();
for (const m of allHtml.matchAll(/(?:href|src|content)\s*=\s*["']([^"']+)["']/gi)) {
  referenced.add(m[1].split(/[?#]/)[0].replace(/^https?:\/\/terryethompson\.com/i, '').replace(/^\//, ''));
}

for (const file of allFiles) {
  if (!ASSET_TYPES.test(file)) continue;
  const bytes = statSync(join(ROOT, file)).size;
  const used = referenced.has(file) || referenced.has(file.split('/').pop());
  const kb = Math.round(bytes / 1024);

  if (!used && bytes > UNUSED_ASSET_LIMIT) {
    warn(file, `Unused file, ${kb} KB`, 'No page references it. It ships with every copy of the site for nothing.');
  }
  if (used && /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(file) && bytes > IMAGE_LIMIT) {
    err(file, `Image is ${kb} KB`, `Over the ${Math.round(IMAGE_LIMIT / 1024)} KB budget — noticeably slow on a phone.`);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const BOLD = '\u001b[1m', RED = '\u001b[31m', YELLOW = '\u001b[33m';
const GREEN = '\u001b[32m', DIM = '\u001b[2m', OFF = '\u001b[0m';

function report(list, colour, label) {
  if (list.length === 0) return;
  console.log(`${colour}${BOLD}${label} (${list.length})${OFF}\n`);
  let current = null;
  for (const item of list.sort((a, b) => a.file.localeCompare(b.file))) {
    if (item.file !== current) { current = item.file; console.log(`  ${BOLD}${current}${OFF}`); }
    console.log(`    ${colour}•${OFF} ${item.title}`);
    console.log(`      ${DIM}${item.detail}${OFF}`);
  }
  console.log('');
}

console.log(`\n${BOLD}Checking ${visitablePages.length} pages${OFF}\n`);
report(errors, RED, 'Problems');
report(warnings, YELLOW, 'Worth a look');

if (errors.length === 0 && warnings.length === 0) {
  console.log(`${GREEN}${BOLD}Every page is ready to share.${OFF}\n`);
  process.exit(0);
}
if (errors.length === 0) {
  console.log(`${GREEN}No problems.${OFF} ${YELLOW}${warnings.length} thing(s) worth a look.${OFF}\n`);
  process.exit(0);
}
console.log(`${RED}${BOLD}${errors.length} problem(s) found.${OFF}\n`);
process.exit(1);
