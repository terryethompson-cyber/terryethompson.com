#!/usr/bin/env node
/**
 * Proves the link checker actually catches things.
 *
 * A checker that quietly passes everything looks exactly like a checker that
 * works. This builds a throwaway site with known problems, runs the real
 * checker against it, and confirms it finds each one — and, just as important,
 * that it stays quiet about a clean site.
 *
 * Run it with:  npm run test:self
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CHECKER = join(dirname(fileURLToPath(import.meta.url)), 'check-links.mjs');

/** Build a temp site from a { path: contents } map and run the checker on it. */
function checkFixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'linkcheck-'));
  try {
    for (const [path, contents] of Object.entries(files)) {
      const abs = join(root, path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, contents);
    }
    try {
      const stdout = execFileSync('node', [CHECKER], {
        env: { ...process.env, SITE_ROOT: root, NO_COLOR: '1' },
        encoding: 'utf8',
      });
      return { exitCode: 0, output: stdout };
    } catch (e) {
      return { exitCode: e.status, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const page = (body) => `<!DOCTYPE html><html lang="en"><body>${body}</body></html>`;

const cases = [
  {
    name: 'a clean site passes',
    files: {
      'index.html': page('<a href="/about.html">About</a>'),
      'about.html': page('<a href="/">Home</a>'),
    },
    expectExit: 0,
    expect: 'All links check out',
  },
  {
    name: 'a link to a file that does not exist fails',
    files: { 'index.html': page('<a href="/nope.html">Gone</a>') },
    expectExit: 1,
    expect: 'Link goes nowhere',
  },
  {
    name: 'wrong capitalisation fails, and names the real path',
    files: {
      'index.html': page('<a href="/Vehicles/tahoe.html">Tahoe</a>'),
      'Vehicles/tahoe.html': page('ok'),
      // Same page, linked with a lowercase folder — fine on a Mac, 404 live.
      'other.html': page('<a href="/vehicles/tahoe.html">Tahoe</a>'),
    },
    expectExit: 1,
    expect: 'Vehicles/tahoe.html',
    also: 'Capitalisation does not match',
  },
  {
    name: 'a full terryethompson.com URL is checked, not skipped',
    files: {
      'index.html': page(
        '<a href="https://terryethompson.com/missing.html">Guide</a>'
      ),
    },
    expectExit: 1,
    expect: 'a full terryethompson.com URL',
  },
  {
    name: 'a page nothing links to is reported',
    files: {
      'index.html': page('<a href="/">Home</a>'),
      'stranded.html': page('Nobody can reach me'),
    },
    expectExit: 1,
    expect: 'Nothing links to this page',
  },
  {
    name: 'a missing #section is reported',
    files: {
      'index.html': page('<a href="/about.html#team">Team</a>'),
      'about.html': page('<h2 id="staff">Staff</h2><a href="/">Home</a>'),
    },
    expectExit: 1,
    expect: 'points at a section that does not exist',
  },
  {
    name: 'a #section that exists is accepted',
    files: {
      'index.html': page('<a href="/about.html#team">Team</a>'),
      'about.html': page('<h2 id="team">Team</h2><a href="/">Home</a>'),
    },
    expectExit: 0,
    expect: 'All links check out',
  },
  {
    name: 'a bad phone number is reported',
    files: { 'index.html': page('<a href="tel:12345">Call</a>') },
    expectExit: 1,
    expect: 'not a usable number',
  },
  {
    name: 'a real phone number is accepted',
    files: { 'index.html': page('<a href="tel:7169324793">Call</a>') },
    expectExit: 0,
    expect: 'All links check out',
  },
  {
    name: 'leaving off .html warns but does not fail the build',
    files: {
      'index.html': page('<a href="/math">Math</a>'),
      'math.html': page('<a href="/">Home</a>'),
    },
    expectExit: 0,
    expect: 'leaves off the .html',
  },
  {
    name: 'external links are left alone',
    files: {
      'index.html': page('<a href="https://www.westherr.com/anything">West Herr</a>'),
    },
    expectExit: 0,
    expect: 'All links check out',
  },
  {
    name: 'relative links from a subfolder resolve correctly',
    files: {
      'index.html': page('<a href="/Vehicles/tahoe.html">Tahoe</a>'),
      'Vehicles/tahoe.html': page('<a href="../index.html">Home</a>'),
    },
    expectExit: 0,
    expect: 'All links check out',
  },
];

let failed = 0;

for (const testCase of cases) {
  const { exitCode, output } = checkFixture(testCase.files);
  const wanted = [testCase.expect, testCase.also].filter(Boolean);
  const missing = wanted.filter((w) => !output.includes(w));
  const exitOk = exitCode === testCase.expectExit;

  if (exitOk && missing.length === 0) {
    console.log(`  ok    ${testCase.name}`);
    continue;
  }

  failed++;
  console.log(`  FAIL  ${testCase.name}`);
  if (!exitOk) {
    console.log(`          expected exit ${testCase.expectExit}, got ${exitCode}`);
  }
  for (const m of missing) {
    console.log(`          expected output to mention: ${m}`);
  }
  console.log(output.split('\n').map((l) => `          | ${l}`).join('\n'));
}

console.log('');
if (failed > 0) {
  console.log(`${failed} of ${cases.length} self-tests failed.\n`);
  process.exit(1);
}
console.log(`All ${cases.length} self-tests passed — the checker is working.\n`);
