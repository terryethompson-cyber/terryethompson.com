#!/usr/bin/env node
/**
 * Checks links that point off terryethompson.com — West Herr, the Google
 * review page, the booking calendar.
 *
 * Kept separate from the main check on purpose. These depend on other people's
 * servers being up, so a slow afternoon at westherr.com should never stop you
 * publishing. This runs on a weekly schedule instead.
 *
 * Run it with:  npm run test:external
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SITE_ROOT
  ? resolve(process.env.SITE_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set(['.git', 'node_modules', '.github']);
const TIMEOUT_MS = 15000;

/**
 * Plenty of sites refuse automated requests. That means the link is fine and
 * the server just doesn't like robots — not something for you to fix.
 */
const BOT_BLOCKED = new Set([401, 403, 405, 406, 429, 999]);

function findHtmlFiles(absDir = ROOT, found = []) {
  for (const entry of readdirSync(absDir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const abs = join(absDir, entry);
    if (statSync(abs).isDirectory()) findHtmlFiles(abs, found);
    else if (entry.endsWith('.html')) found.push(relative(ROOT, abs).split('\\').join('/'));
  }
  return found;
}

// Collect every external URL, remembering everywhere it appears.
const urls = new Map();

for (const file of findHtmlFiles().sort()) {
  const source = readFileSync(join(ROOT, file), 'utf8');
  for (const match of source.matchAll(/\b(?:href|src)\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) {
    const url = match[1];
    if (url.includes('terryethompson.com')) continue; // handled by check-links
    const line = source.slice(0, match.index).split('\n').length;
    if (!urls.has(url)) urls.set(url, []);
    urls.get(url).push(`${file}:${line}`);
  }
}

async function probe(url) {
  // HEAD first — cheaper. Some servers don't implement it, so fall back to GET.
  for (const method of ['HEAD', 'GET']) {
    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; terryethompson.com link check; +https://terryethompson.com)',
        },
      });
      if (response.status === 404 && method === 'HEAD') continue;
      if (response.status >= 400 && method === 'HEAD') continue;
      return { status: response.status };
    } catch (error) {
      if (method === 'GET') return { status: null, error: error.message };
    }
  }
  return { status: null, error: 'no response' };
}

console.log(`\nChecking ${urls.size} external links\n`);

const dead = [];
const unknown = [];

const results = await Promise.all(
  [...urls.keys()].map(async (url) => ({ url, ...(await probe(url)) }))
);

for (const { url, status, error } of results.sort((a, b) => a.url.localeCompare(b.url))) {
  const where = urls.get(url);

  if (status && status < 400) {
    console.log(`  ok    ${status}  ${url}`);
  } else if (status && BOT_BLOCKED.has(status)) {
    console.log(`  ok    ${status}  ${url}  (server blocks automated checks — link is fine)`);
  } else if (status) {
    console.log(`  DEAD  ${status}  ${url}`);
    dead.push({ url, detail: `returned ${status}`, where });
  } else {
    console.log(`  ????  ---  ${url}  (${error})`);
    unknown.push({ url, detail: error, where });
  }
}

console.log('');

for (const item of dead) {
  console.log(`Broken: ${item.url}`);
  console.log(`  ${item.detail}`);
  console.log(`  used on: ${item.where.join(', ')}\n`);
}

if (unknown.length > 0) {
  console.log(
    `${unknown.length} link(s) could not be reached. That is often a temporary ` +
      `outage rather than a broken link — worth re-running before acting on it.\n`
  );
}

if (dead.length > 0) {
  console.log(`${dead.length} external link(s) are genuinely broken.\n`);
  process.exit(1);
}

console.log('No broken external links.\n');
