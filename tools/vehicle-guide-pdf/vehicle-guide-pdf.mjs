#!/usr/bin/env node
/*
 * vehicle-guide-pdf.mjs
 * Prints the real guide pages to PDF.
 *
 *   node tools/vehicle-guide-pdf/vehicle-guide-pdf.mjs            # all guides
 *   node tools/vehicle-guide-pdf/vehicle-guide-pdf.mjs Vehicles/2027-chevy-tahoe.html
 *
 * The handout IS the page, printed. There is no second design to keep in
 * sync, so the paper version can never drift from the web version: same
 * hero, same trim cards, same colours, same words.
 *
 * Only the parts that make no sense on paper are stripped: the fixed
 * navigation bar and the button that offers this very PDF.
 */
import { readdirSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GUIDES = join(ROOT, 'Vehicles');
const OUT = join(GUIDES, 'print');

/* 2027-chevy-silverado-1500.html -> 2027-Chevy-Silverado-1500-Guide.pdf
   Keeps the filenames the site already links to. */
function pdfNameFor(htmlFile) {
  const stem = basename(htmlFile, '.html');
  const titled = stem.split('-')
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('-');
  return `${titled}-Guide.pdf`;
}

/*
 * Print rules. Deliberately small: everything the page already does is what
 * we want on paper. Anything added here is a thing paper cannot do.
 */
const PRINT_CSS = `
  /* The nav is fixed to the viewport. On paper it would stamp itself over
     the top of every sheet. */
  .sticky-bar, .subnav-mobile { display: none !important; }
  /* That nav's spacer, an inline style on the hero's wrapper. */
  body > div[style*="padding-top"] { padding-top: 0 !important; }
  /* A button offering this very PDF, inside this very PDF. */
  .print-bar { display: none !important; }

  /* Order banks, production start, dealer arrivals. These dates move every
     few weeks. A printed sheet cannot be updated, and stale dates in a
     customer's hand are worse than no dates, so the timeline stays on the
     web page only. This is also what buys the third page. */
  .timeline-section { display: none !important; }

  /* Paper is shorter than a scroll. Tighten the web rhythm without touching
     the type or the colour. */
  section { padding-top: 20px !important; padding-bottom: 20px !important; }
  .guide-hero { padding: 30px 24px 24px !important; }
  .summary-bar { padding: 18px 24px !important; }
  .final-cta { padding: 26px 24px !important; }
  .disclaimer { padding: 16px 24px !important; }
  .section-sub { margin-bottom: 20px !important; }
  /* The footer on every sheet already says how to reach Terry. */
  .final-cta .section-sub { display: none !important; }
  .final-option { padding: 16px 14px !important; }

  /* The print canvas is wider than the web column, so the same cards sit in
     fewer rows. Same cards, same styling, fewer sheets. */
  .trim-grid { grid-template-columns: repeat(4, 1fr) !important; }
  .engine-grid { grid-template-columns: repeat(4, 1fr) !important; }

  /* Never split a card across a page break. */
  .trim-card, .timeline-card, .engine-card, .rec-card, .final-option,
  .change-list li, .guide-card { break-inside: avoid; page-break-inside: avoid; }
  h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
  .section-label { break-after: avoid; }
  .summary-bar, .disclaimer, footer { break-inside: avoid; }
`;

/* A showroom handout has to be something you can hand across a desk.
   0.70 prints the page at about 11pt body text and lands every guide on
   three sheets. Raising it pushes past three; lowering it gets hard to read. */
const SCALE = 0.70;
const MAX_PAGES = 3;

const FOOTER = `
  <div style="width:100%;font-family:Calibri,Segoe UI,Helvetica,Arial,sans-serif;
              font-size:8px;color:#6E7C87;padding:0 34px;
              display:flex;justify-content:space-between;">
    <span>Terry Thompson &nbsp;&middot;&nbsp; West Herr Chevrolet of Williamsville
          &nbsp;&middot;&nbsp; Call Terry direct &nbsp;&middot;&nbsp; 716-932-4793</span>
    <span class="pageNumber"></span>
  </div>`;

const targets = process.argv.slice(2).length
  ? process.argv.slice(2).map((p) => resolve(p))
  : readdirSync(GUIDES)
      .filter((f) => f.endsWith('.html') && f !== 'index.html')
      .sort()
      .map((f) => join(GUIDES, f));

mkdirSync(OUT, { recursive: true });

let overBudget = false;
const browser = await chromium.launch();
for (const html of targets) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await page.addStyleTag({ content: PRINT_CSS });
  // The page sets its own body padding from JS to clear the fixed nav.
  await page.evaluate(() => { document.body.style.paddingTop = '0'; });
  const out = join(OUT, pdfNameFor(html));
  await page.pdf({
    path: out,
    format: 'Letter',
    printBackground: true,
    // Zero side margins keep the layout above the 768px mobile breakpoint and
    // let the dark hero bleed to the paper edge, the way it does on screen.
    scale: SCALE,
    margin: { top: '0', right: '0', bottom: '0.42in', left: '0' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: FOOTER,
  });
  await page.close();

  // A guide that grows past the budget should be caught here, not in the
  // showroom with a stack of paper already printed.
  const pages = (readFileSync(out).toString('latin1')
    .match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`wrote ${out.replace(ROOT + '/', '')}  (${pages} pages)`);
  if (pages > MAX_PAGES) {
    console.error(`  WARNING: over the ${MAX_PAGES}-page handout budget.`);
    overBudget = true;
  }
}
await browser.close();
if (overBudget) process.exitCode = 1;
