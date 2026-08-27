#!/usr/bin/env node
/**
 * Link and route integrity check for terryethompson.com
 *
 * Answers three questions on every commit:
 *   1. Does every link on the site actually go somewhere real?
 *   2. Does it still work on a case-sensitive web server? (Macs are forgiving
 *      about capital letters. GitHub Pages and Netlify are not. A link that
 *      works on your laptop can 404 for a customer.)
 *   3. Can every page be reached by clicking from the home page?
 *
 * Run it with:  npm test
 *
 * No dependencies. Plain Node, nothing to install.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// The site to check. Defaults to this repo; SITE_ROOT lets the self-test point
// it at a throwaway folder of deliberately broken pages.
const ROOT = process.env.SITE_ROOT
  ? resolve(process.env.SITE_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Configuration — edit these as the site grows
// ---------------------------------------------------------------------------

/** Pages a visitor should be able to reach by clicking, starting here. */
const ENTRY_POINTS = ['index.html'];

/**
 * Files that are building blocks, not pages. Their links are still checked,
 * but nobody expects to navigate to them, so they aren't reported as orphans.
 */
const NOT_PAGES = new Set(['brand-spine-snippet.html']);

/** Absolute URLs that are really this site, so they get checked as local paths. */
const SITE_ORIGINS = [
  'https://terryethompson.com',
  'https://www.terryethompson.com',
  'http://terryethompson.com',
  'http://www.terryethompson.com',
];

/** Directories never worth walking into. */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.github']);

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

const errors = [];
const warnings = [];

const err = (file, line, title, detail) =>
  errors.push({ file, line, title, detail });
const warn = (file, line, title, detail) =>
  warnings.push({ file, line, title, detail });

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

const dirCache = new Map();

/** Directory entries, cached. Returns [] for anything that isn't a directory. */
function entriesOf(absDir) {
  if (dirCache.has(absDir)) return dirCache.get(absDir);
  let entries = [];
  try {
    entries = readdirSync(absDir);
  } catch {
    entries = [];
  }
  dirCache.set(absDir, entries);
  return entries;
}

/**
 * Walk a repo-relative path one segment at a time, requiring an exact
 * (case-sensitive) match at every level.
 *
 * This is the heart of the check. `statSync` would happily confirm that
 * "vehicles/foo.html" exists on a Mac even when the folder is really
 * "Vehicles/" — and then the live site 404s. Comparing directory listings
 * ourselves catches it locally, before it ships.
 *
 * Returns { ok, actual } where `actual` is the real capitalisation on disk
 * when we find a case-insensitive match for a path that doesn't exist as typed.
 */
function resolveExact(relPath) {
  const segments = relPath.split('/').filter((s) => s.length > 0);
  let cursor = ROOT;
  const actual = [];
  let caseMismatch = false;

  for (const segment of segments) {
    const entries = entriesOf(cursor);

    if (entries.includes(segment)) {
      actual.push(segment);
      cursor = join(cursor, segment);
      continue;
    }

    // Keep walking after a capitalisation slip so the error message can show
    // the whole correct path, not just the first segment that went wrong.
    const lower = segment.toLowerCase();
    const nearMiss = entries.find((e) => e.toLowerCase() === lower);
    if (nearMiss) {
      caseMismatch = true;
      actual.push(nearMiss);
      cursor = join(cursor, nearMiss);
      continue;
    }

    return { ok: false, actual: null, reason: 'missing' };
  }

  if (caseMismatch) {
    return { ok: false, actual: actual.join('/'), reason: 'case' };
  }
  return { ok: true, actual: actual.join('/') };
}

function isDirectory(relPath) {
  try {
    return statSync(join(ROOT, relPath)).isDirectory();
  } catch {
    return false;
  }
}

/** Every .html file in the repo, as repo-relative paths. */
function findHtmlFiles(absDir = ROOT, found = []) {
  for (const entry of readdirSync(absDir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const abs = join(absDir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) findHtmlFiles(abs, found);
    else if (entry.endsWith('.html')) found.push(relative(ROOT, abs).split('\\').join('/'));
  }
  return found;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const LINK_PATTERN = /\b(href|src|action)\s*=\s*["']([^"']*)["']/gi;

/** Pull every href/src/action out of a file, with the line each sits on. */
function extractLinks(relFile) {
  const source = readFileSync(join(ROOT, relFile), 'utf8');
  const links = [];

  for (const match of source.matchAll(LINK_PATTERN)) {
    const line = source.slice(0, match.index).split('\n').length;
    links.push({ attr: match[1].toLowerCase(), value: match[2].trim(), line });
  }
  return links;
}

/** Collapse "a/b/../c" and "./c" into a clean path. */
function normalise(path) {
  const out = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

// ---------------------------------------------------------------------------
// Per-link checks
// ---------------------------------------------------------------------------

/** Records which pages link to which, so we can find unreachable pages later. */
const outboundLinks = new Map();

function checkLink(sourceFile, link) {
  const { attr, value, line } = link;
  const at = (title, detail) => err(sourceFile, line, title, detail);

  if (value === '' || value === '#') return;
  if (/^(data|javascript|blob):/i.test(value)) return;

  // Contact links — the site's main call to action, so worth validating.
  if (/^(tel|sms):/i.test(value)) {
    const digits = value.split(':')[1].replace(/[^0-9+]/g, '');
    if (digits.replace(/\D/g, '').length < 10) {
      at('Phone link is not a usable number', `${attr}="${value}"`);
    }
    return;
  }

  if (/^mailto:/i.test(value)) {
    if (!/^mailto:[^@\s]+@[^@\s.]+\.[^@\s]+$/i.test(value)) {
      at('Email link is malformed', `${attr}="${value}"`);
    }
    return;
  }

  // Same-site absolute URLs get rewritten to local paths so they're checked
  // for real. This is what catches a canonical tag pointing at a 404.
  let target = value;
  let wasAbsoluteSelfLink = false;

  const origin = SITE_ORIGINS.find((o) => target.toLowerCase().startsWith(o));
  if (origin) {
    target = target.slice(origin.length) || '/';
    wasAbsoluteSelfLink = true;
  } else if (/^https?:\/\//i.test(target) || target.startsWith('//')) {
    return; // genuinely external — checked separately, on a schedule
  }

  // Split off the query string and #fragment.
  const [pathAndQuery, fragment = ''] = target.split('#');
  const path = pathAndQuery.split('?')[0];

  if (path === '') return; // a bare "#fragment" on the current page

  // Work out where the link points, relative to the repo root.
  let relPath = path.startsWith('/')
    ? normalise(path)
    : normalise(join(dirname(sourceFile), path).split('\\').join('/'));

  // "/" and "/some/dir/" mean the index.html inside them.
  if (path.endsWith('/') || relPath === '') {
    relPath = normalise(`${relPath}/index.html`);
  } else if (!/\.[a-z0-9]+$/i.test(relPath)) {
    // No file extension. Could be a folder, or the host might silently add
    // ".html" — that behaviour differs between hosts, so flag it rather than
    // guess wrong in either direction.
    if (isDirectory(relPath)) {
      relPath = `${relPath}/index.html`;
    } else if (resolveExact(`${relPath}.html`).ok) {
      warn(
        sourceFile,
        line,
        'Link leaves off the .html and may 404',
        `${attr}="${value}" — "${relPath}.html" exists, but only some hosts ` +
          `map "/${relPath}" to it. Every other link on the site includes the ` +
          `extension; make this one match.`
      );
      recordPageLink(sourceFile, `${relPath}.html`);
      return;
    } else {
      at('Link goes nowhere', `${attr}="${value}" — no such file or folder`);
      return;
    }
  }

  const resolved = resolveExact(relPath);

  if (!resolved.ok && resolved.reason === 'case') {
    at(
      'Capitalisation does not match the real file',
      `${attr}="${value}" — points at "${relPath}", but on disk it is ` +
        `"${resolved.actual}". This works on a Mac and 404s on the live site.`
    );
    return;
  }

  if (!resolved.ok) {
    at(
      'Link goes nowhere',
      `${attr}="${value}"${wasAbsoluteSelfLink ? ' (a full terryethompson.com URL)' : ''} — ` +
        `no file at "${relPath}"`
    );
    return;
  }

  // The file exists. If the link also names a #section, make sure it's there.
  if (fragment && relPath.endsWith('.html')) {
    const targetSource = readFileSync(join(ROOT, relPath), 'utf8');
    const hasTarget = new RegExp(
      `\\b(id|name)\\s*=\\s*["']${fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`
    ).test(targetSource);
    if (!hasTarget) {
      at(
        'Link points at a section that does not exist',
        `${attr}="${value}" — "${relPath}" has nothing marked "${fragment}"`
      );
    }
  }

  if (relPath.endsWith('.html')) recordPageLink(sourceFile, relPath);
}

function recordPageLink(from, to) {
  if (!outboundLinks.has(from)) outboundLinks.set(from, new Set());
  outboundLinks.get(from).add(to);
}

// ---------------------------------------------------------------------------
// Orphan check — can you actually click your way to every page?
// ---------------------------------------------------------------------------

function findOrphans(allPages) {
  const reachable = new Set();
  const queue = [...ENTRY_POINTS];

  while (queue.length > 0) {
    const page = queue.shift();
    if (reachable.has(page)) continue;
    reachable.add(page);
    for (const next of outboundLinks.get(page) ?? []) {
      if (!reachable.has(next)) queue.push(next);
    }
  }

  return allPages.filter((p) => !reachable.has(p) && !NOT_PAGES.has(p));
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const BOLD = '\u001b[1m';
const RED = '\u001b[31m';
const YELLOW = '\u001b[33m';
const GREEN = '\u001b[32m';
const DIM = '\u001b[2m';
const OFF = '\u001b[0m';

function report(list, colour, label) {
  if (list.length === 0) return;

  console.log(`${colour}${BOLD}${label} (${list.length})${OFF}\n`);

  let currentFile = null;
  for (const item of list) {
    if (item.file !== currentFile) {
      currentFile = item.file;
      console.log(`  ${BOLD}${currentFile}${OFF}`);
    }
    console.log(`    ${colour}line ${item.line}${OFF}  ${item.title}`);
    console.log(`      ${DIM}${item.detail}${OFF}`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const pages = findHtmlFiles().sort();

console.log(`\n${BOLD}Checking links across ${pages.length} pages${OFF}\n`);

for (const page of pages) {
  for (const link of extractLinks(page)) checkLink(page, link);
}

for (const orphan of findOrphans(pages)) {
  err(
    orphan,
    1,
    'Nothing links to this page',
    'A visitor cannot reach it by clicking from the home page, and search ' +
      'engines are unlikely to find it. Link to it, or add it to NOT_PAGES ' +
      'in tests/check-links.mjs if it is intentionally unlisted.'
  );
}

errors.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
warnings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

report(errors, RED, 'Broken');
report(warnings, YELLOW, 'Worth fixing');

if (errors.length === 0 && warnings.length === 0) {
  console.log(`${GREEN}${BOLD}All links check out.${OFF}\n`);
  process.exit(0);
}

if (errors.length === 0) {
  console.log(
    `${GREEN}No broken links.${OFF} ${YELLOW}${warnings.length} thing(s) worth a look.${OFF}\n`
  );
  process.exit(0);
}

console.log(
  `${RED}${BOLD}${errors.length} broken link(s) found.${OFF} ` +
    `Fix these before publishing.\n`
);
process.exit(1);
