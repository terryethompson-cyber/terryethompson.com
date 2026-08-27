#!/usr/bin/env node
/**
 * Rebuilds sitemap.xml from the pages that actually exist.
 *
 * Run it after adding a page:  npm run sitemap
 *
 * The page check fails if the sitemap is out of date, so this never silently
 * drifts. Deliberately no <lastmod>: a wrong date is worse than none, and it
 * is not something search engines lean on.
 */

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://terryethompson.com';

/** Building blocks, not pages people visit. Keep in step with check-links.mjs. */
export const NOT_PAGES = new Set(['brand-spine-snippet.html']);

const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'tests']);

export function findPages(absDir = ROOT, found = []) {
  for (const entry of readdirSync(absDir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const abs = join(absDir, entry);
    if (statSync(abs).isDirectory()) findPages(abs, found);
    else if (entry.endsWith('.html')) found.push(relative(ROOT, abs).split('\\').join('/'));
  }
  return found;
}

/** The address a visitor uses, which is not always the filename. */
export function urlFor(page) {
  if (page === 'index.html') return `${SITE}/`;
  if (page.endsWith('/index.html')) return `${SITE}/${page.slice(0, -'index.html'.length)}`;
  return `${SITE}/${page}`;
}

export function sitemapUrls() {
  return findPages()
    .filter((p) => !NOT_PAGES.has(p))
    .map(urlFor)
    .sort();
}

export function renderSitemap(urls) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url>\n    <loc>${u}</loc>\n  </url>`),
    '</urlset>',
    '',
  ].join('\n');
}

// Only write when run directly, so the checker can import the helpers.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const urls = sitemapUrls();
  writeFileSync(join(ROOT, 'sitemap.xml'), renderSitemap(urls));
  console.log(`sitemap.xml rebuilt with ${urls.length} pages:`);
  for (const u of urls) console.log(`  ${u}`);
}
