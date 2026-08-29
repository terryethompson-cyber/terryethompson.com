#!/usr/bin/env node
/*
 * vehicle-guide-pdf.mjs
 * Builds a print-ready showroom PDF from a vehicle-guide JSON spec.
 *
 *   node vehicle-guide-pdf.mjs specs/silverado.json ../../Vehicles/print/2027-Chevy-Silverado-1500-Guide.pdf
 *
 * The spec is rendered to HTML with the same brand tokens and type as the
 * guide pages on terryethompson.com, then printed to US Letter by Chromium.
 * Playwright is already a devDependency for the browser tests, so this needs
 * nothing extra.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const BLUE = '#0057B8', DARK = '#3B5166', TEXT = '#2C3E50';
const MUTED = '#6E7C87', PALE = '#D6DBDF', LIGHT = '#F2F4F6';
const FAINT = '#C9D4E0';
const SERIF = "'Cambria', Georgia, 'Times New Roman', serif";
const SANS = "'Calibri', 'Segoe UI', Helvetica, Arial, sans-serif";
const PHONE = '716-932-4793';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Each block type mirrors the one in the web guide it came from. */
const BLOCKS = {
  heading: (b) => `
    <section class="blk head">
      <p class="label">${esc(b.label)}</p>
      <h2>${esc(b.heading)}</h2>
      ${b.sub ? `<p class="sub">${esc(b.sub)}</p>` : ''}
    </section>`,

  paras: (b) => `
    <section class="blk">
      ${b.items.map((t) => `<p class="body">${esc(t)}</p>`).join('')}
    </section>`,

  bullets: (b) => `
    <section class="blk">
      <ul class="bullets">
        ${b.items.map(([lead, rest]) =>
          `<li><strong>${esc(lead)}</strong> ${esc(rest)}</li>`).join('')}
      </ul>
    </section>`,

  trims: (b) => {
    const heads = b.priceHeads || [];
    return `
    <section class="blk">
      <table class="trims">
        <thead>
          <tr>
            <th class="c-name">Trim</th>
            <th>What you get</th>
            ${heads.map((h) => `<th class="c-price">${esc(h)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${b.rows.map((r) => `
          <tr>
            <td class="c-name"><span class="tname">${esc(r.name)}</span><span class="tag">${esc(r.tag)}</span></td>
            <td>${esc(r.desc)}</td>
            ${heads.length ? `<td class="c-price">${esc(r.price1 || '')}</td>` : ''}
            ${heads.length > 1 ? `<td class="c-price">${esc(r.price2 || '')}</td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    </section>`;
  },

  timeline: (b) => `
    <section class="blk">
      <div class="cards three">
        ${b.cards.map((c) => `
        <div class="card tl">
          <span class="k">${esc(c.k)}</span>
          <span class="v">${esc(c.v)}</span>
          <span class="note">${esc(c.note)}</span>
        </div>`).join('')}
      </div>
    </section>`,

  specs: (b) => `
    <section class="blk">
      <div class="cards ${b.cards.length === 4 ? 'four' : 'three'}">
        ${b.cards.map((c) => `
        <div class="card spec">
          <span class="big">${esc(c.big)}</span>
          <span class="small">${esc(c.small)}</span>
        </div>`).join('')}
      </div>
    </section>`,

  recs: (b) => `
    <section class="blk">
      <div class="cards three">
        ${b.cards.map((c) => `
        <div class="card rec">
          <h4>${esc(c.h)}</h4>
          <p>${esc(c.body)}</p>
        </div>`).join('')}
      </div>
    </section>`,

  note: (b) => `<p class="caveat">${esc(b.text)}</p>`,
};

export function html(spec) {
  const body = spec.blocks.map((b) => {
    const fn = BLOCKS[b.type];
    if (!fn) throw new Error('unknown block type: ' + b.type);
    return fn(b);
  }).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(spec.title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ${SANS}; font-size: 10pt; line-height: 1.5; color: ${TEXT}; }

  .masthead { background: ${DARK}; color: #fff; padding: 16pt 18pt; }
  .masthead .eyebrow {
    font-size: 7pt; font-weight: 700; letter-spacing: .12em;
    text-transform: uppercase; color: ${FAINT}; margin-bottom: 5pt;
  }
  .masthead h1 { font-family: ${SERIF}; font-size: 21pt; font-weight: 700; line-height: 1.15; }
  .masthead .hero { font-family: ${SERIF}; font-size: 12pt; font-style: italic; color: ${FAINT}; margin-top: 3pt; }

  .short { background: ${PALE}; padding: 12pt 18pt; }
  .short .label {
    font-size: 7pt; font-weight: 700; letter-spacing: .12em;
    text-transform: uppercase; color: ${BLUE}; margin-bottom: 4pt;
  }
  .short p { font-size: 9.5pt; }

  .blk { padding: 0 18pt; margin-top: 11pt; break-inside: avoid; }
  .blk.head { margin-top: 15pt; }
  .label {
    font-size: 7pt; font-weight: 700; letter-spacing: .12em;
    text-transform: uppercase; color: ${BLUE}; margin-bottom: 3pt;
  }
  h2 {
    font-family: ${SERIF}; font-size: 14pt; font-weight: 700; color: ${TEXT};
    line-height: 1.2; padding-bottom: 4pt; border-bottom: 1px solid ${PALE};
  }
  .sub { font-size: 9pt; color: ${MUTED}; margin-top: 5pt; }
  p.body { font-size: 9.5pt; margin-bottom: 6pt; }
  p.body:last-child { margin-bottom: 0; }
  .caveat { padding: 0 18pt; margin-top: 8pt; font-size: 8pt; font-style: italic; color: ${MUTED}; }

  ul.bullets { list-style: none; }
  ul.bullets li {
    position: relative; padding-left: 13pt; margin-bottom: 5pt; font-size: 9.5pt;
    break-inside: avoid;
  }
  ul.bullets li::before {
    content: ''; position: absolute; left: 0; top: 4.5pt;
    width: 4pt; height: 4pt; border-radius: 50%; background: ${BLUE};
  }

  table.trims { width: 100%; border-collapse: collapse; }
  table.trims th {
    text-align: left; font-size: 7pt; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: ${BLUE};
    padding: 0 6pt 4pt 0; border-bottom: 1px solid ${PALE};
  }
  table.trims td {
    vertical-align: top; padding: 6pt 6pt 6pt 0;
    border-bottom: 1px solid ${PALE}; font-size: 9pt;
  }
  table.trims tr { break-inside: avoid; }
  .c-name { width: 21%; }
  .c-price { width: 13%; white-space: nowrap; }
  .tname { display: block; font-weight: 700; font-size: 9.5pt; }
  .tag {
    display: inline-block; margin-top: 2pt; padding: 1pt 4pt;
    background: ${PALE}; color: ${BLUE};
    font-size: 6.5pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
  }

  .cards { display: grid; gap: 7pt; }
  .cards.three { grid-template-columns: repeat(3, 1fr); }
  .cards.four { grid-template-columns: repeat(4, 1fr); }
  .card { break-inside: avoid; }
  .card.tl { background: #fff; border: 1px solid ${PALE}; border-top: 2.5pt solid ${BLUE}; padding: 7pt 8pt; }
  .card.tl .k { display: block; font-size: 6.5pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: ${BLUE}; }
  .card.tl .v { display: block; font-family: ${SERIF}; font-size: 11pt; font-weight: 700; margin: 2pt 0 3pt; }
  .card.tl .note { display: block; font-size: 8pt; color: ${MUTED}; line-height: 1.4; }
  .card.spec { background: ${LIGHT}; padding: 9pt 8pt; text-align: center; }
  .card.spec .big { display: block; font-family: ${SERIF}; font-size: 17pt; font-weight: 700; color: ${BLUE}; line-height: 1; }
  .card.spec .small { display: block; font-size: 8pt; color: ${MUTED}; margin-top: 4pt; line-height: 1.4; }
  .card.rec { background: ${LIGHT}; padding: 8pt 9pt; }
  .card.rec h4 { font-family: ${SERIF}; font-size: 10pt; font-weight: 700; margin-bottom: 3pt; }
  .card.rec p { font-size: 8.5pt; color: ${MUTED}; line-height: 1.45; }

  .cta {
    background: ${DARK}; color: #fff; text-align: center;
    padding: 14pt 18pt; margin: 16pt 18pt 0; break-inside: avoid;
  }
  .cta .h { font-family: ${SERIF}; font-size: 13pt; font-weight: 700; }
  .cta .num { font-size: 12pt; font-weight: 700; margin-top: 4pt; }
  .cta .meta { font-size: 8.5pt; color: ${FAINT}; margin-top: 4pt; }

  .disclaimer { padding: 0 18pt; margin-top: 10pt; font-size: 7pt; color: ${MUTED}; line-height: 1.45; }
  .footline {
    margin: 6pt 18pt 0; padding-top: 5pt; border-top: 1px solid ${PALE};
    font-size: 7pt; color: ${MUTED};
  }
</style></head><body>

<div class="masthead">
  <p class="eyebrow">Vehicle Guide &nbsp;&bull;&nbsp; Terry Thompson &nbsp;&bull;&nbsp; West Herr Chevrolet of Williamsville</p>
  <h1>${esc(spec.title)}</h1>
  <p class="hero">${esc(spec.heroLine)}</p>
</div>

<div class="short">
  <p class="label">The Short Version</p>
  <p>${esc(spec.shortVersion)}</p>
</div>

${body}

<div class="cta">
  <p class="h">Questions? Let&rsquo;s talk it through.</p>
  <p class="num">Call Terry direct &nbsp;&bull;&nbsp; ${PHONE}</p>
  <p class="meta">terry.thompson@westherr.com &nbsp;&bull;&nbsp; ${esc(spec.url)}</p>
</div>

<p class="disclaimer">${esc(spec.disclaimer)}</p>
<p class="footline">Terry Thompson &nbsp;&bull;&nbsp; West Herr Chevrolet of Williamsville &nbsp;&bull;&nbsp; Buffalo, New York &nbsp;&bull;&nbsp; Not the dealership, Terry&rsquo;s personal brand site.</p>

</body></html>`;
}

/* Only run as a CLI when invoked directly, so html() stays importable. */
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [specPath, outPath] = process.argv.slice(2);
  if (!specPath || !outPath) {
    console.error('usage: node vehicle-guide-pdf.mjs <spec.json> <out.pdf>');
    process.exit(1);
  }
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html(spec), { waitUntil: 'load' });
  await page.pdf({
    path: outPath,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
  });
  await browser.close();
  console.log('wrote ' + outPath);
}
