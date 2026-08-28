#!/usr/bin/env node
/*
 * vehicle-guide-docx.js
 * Builds a print-ready showroom Word doc from a vehicle-guide JSON spec.
 *   node vehicle-guide-docx.js spec.json out.docx
 * Brand tokens and type match terryethompson.com's guide pages.
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign,
} = require('docx');
const fs = require('fs');

const BLUE = '0057B8', DARK = '3B5166', TEXT = '2C3E50';
const MUTED = '6E7C87', PALE = 'D6DBDF', LIGHT = 'F2F4F6', WHITE = 'FFFFFF';
const SERIF = 'Cambria', SANS = 'Calibri';
const CONTENT_W = 10080; // 8.5in letter minus 0.75in margins each side

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const gutters = {
  top: NONE, bottom: NONE, left: NONE, right: NONE,
  insideHorizontal: NONE,
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: WHITE },
};

const p = (o) => new Paragraph(o);
const run = (text, o = {}) => new TextRun({
  text,
  font: o.font || SANS,
  size: o.size || 20,
  bold: !!o.bold,
  italics: !!o.italics,
  color: o.color || TEXT,
  allCaps: !!o.caps,
  characterSpacing: o.spacing,
});

function cell(children, o = {}) {
  return new TableCell({
    width: { size: o.width, type: WidthType.DXA },
    shading: o.shading ? { type: ShadingType.CLEAR, fill: o.shading, color: 'auto' } : undefined,
    margins: {
      top: o.mt !== undefined ? o.mt : 90,
      bottom: o.mb !== undefined ? o.mb : 90,
      left: 120, right: 120,
    },
    verticalAlign: o.valign || VerticalAlign.TOP,
    borders: o.borders,
    children,
  });
}

// Evenly split CONTENT_W into n columns, absorbing rounding into the last one.
function split(n) {
  const w = Math.floor(CONTENT_W / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? CONTENT_W - w * (n - 1) : w));
}

function bandTable(children, shading, pad) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    borders: noBorders,
    rows: [new TableRow({ children: [cell(children, { width: CONTENT_W, shading, mt: pad, mb: pad })] })],
  });
}

// One row of equal-width tinted cards.
function cardRow(cards, render) {
  const widths = split(cards.length);
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    borders: gutters,
    rows: [new TableRow({
      children: cards.map((c, i) => cell(render(c), { width: widths[i], shading: LIGHT, mt: 140, mb: 140 })),
    })],
  });
}

function heading(label, text, sub) {
  const out = [
    p({ spacing: { before: 260, after: 40 }, children: [run(label, { size: 15, bold: true, color: BLUE, caps: true, spacing: 30 })] }),
    p({
      spacing: { after: sub ? 90 : 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PALE, space: 4 } },
      children: [run(text, { font: SERIF, size: 24, bold: true, color: TEXT })],
    }),
  ];
  if (sub) out.push(p({ spacing: { after: 110 }, children: [run(sub, { size: 19, color: MUTED })] }));
  return out;
}

const BLOCKS = {
  heading: (b) => heading(b.label, b.heading, b.sub),

  paras: (b) => b.items.map((t, i) => p({
    spacing: { after: i === b.items.length - 1 ? 0 : 70 },
    children: [run(t, { size: 19 })],
  })),

  bullets: (b) => b.items.map(([lead, rest]) => p({
    bullet: { level: 0 },
    spacing: { after: 70 },
    children: [run(lead + ' ', { bold: true, size: 19 }), run(rest, { size: 19 })],
  })),

  note: (b) => [p({ spacing: { before: 90 }, children: [run(b.text, { size: 17, color: MUTED, italics: true })] })],

  specs: (b) => [cardRow(b.cards, (c) => [
    p({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run(c.big, { font: SERIF, size: 26, bold: true, color: BLUE })] }),
    p({ alignment: AlignmentType.CENTER, children: [run(c.small, { size: 16, color: MUTED })] }),
  ])],

  recs: (b) => [cardRow(b.cards, (c) => [
    p({ spacing: { after: 50 }, children: [run(c.h, { font: SERIF, size: 20, bold: true, color: TEXT })] }),
    p({ children: [run(c.body, { size: 17, color: MUTED })] }),
  ])],

  timeline: (b) => [cardRow(b.cards, (c) => [
    p({ spacing: { after: 40 }, children: [run(c.k, { size: 14, bold: true, color: BLUE, caps: true, spacing: 20 })] }),
    p({ spacing: { after: 50 }, children: [run(c.v, { font: SERIF, size: 20, bold: true, color: TEXT })] }),
    p({ children: [run(c.note, { size: 16, color: MUTED })] }),
  ])],

  trims: (b) => {
    const priced = !!b.priceHeads;
    const widths = priced ? [1500, 5220, 1680, 1680] : [1900, CONTENT_W - 1900];
    const heads = priced ? ['Trim', 'What you get', ...b.priceHeads] : ['Trim', 'What you get'];

    const headCells = heads.map((h, i) => cell([p({
      alignment: i >= 2 ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [run(h, { size: 15, bold: true, color: WHITE, caps: true, spacing: 30 })],
    })], { width: widths[i], shading: DARK, mt: 80, mb: 80 }));

    const bodyRows = b.rows.map((r, idx) => {
      const shade = idx % 2 === 1 ? LIGHT : undefined;
      const cells = [
        cell([
          p({ children: [run(r.name, { font: SERIF, size: 22, bold: true, color: TEXT })] }),
          p({ children: [run(r.tag, { size: 14, bold: true, color: BLUE, caps: true, spacing: 20 })] }),
        ], { width: widths[0], shading: shade }),
        cell([p({ children: [run(r.desc, { size: 18 })] })], { width: widths[1], shading: shade }),
      ];
      if (priced) {
        [r.price1, r.price2].forEach((v, i) => cells.push(cell([p({
          alignment: AlignmentType.RIGHT,
          children: [run(v, { font: SERIF, size: 22, bold: true, color: BLUE })],
        })], { width: widths[2 + i], shading: shade })));
      }
      return new TableRow({ children: cells });
    });

    return [new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: widths,
      borders: {
        top: NONE, bottom: NONE, left: NONE, right: NONE,
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: PALE },
        insideVertical: NONE,
      },
      rows: [new TableRow({ tableHeader: true, children: headCells }), ...bodyRows],
    })];
  },
};

function build(spec) {
  const children = [
    // Masthead
    bandTable([
      p({ spacing: { after: 40 }, children: [run('Vehicle Guide  •  Terry Thompson  •  West Herr Chevrolet of Williamsville', { size: 15, bold: true, color: 'C9D4E0', caps: true, spacing: 30 })] }),
      p({ spacing: { after: 30 }, children: [run(spec.title, { font: SERIF, size: 40, bold: true, color: WHITE })] }),
      p({ children: [run(spec.heroLine, { font: SERIF, size: 24, italics: true, color: 'C9D4E0' })] }),
    ], DARK, 200),

    // Short version
    bandTable([
      p({ spacing: { after: 50 }, children: [run('The Short Version', { size: 15, bold: true, color: BLUE, caps: true, spacing: 30 })] }),
      p({ children: [run(spec.shortVersion, { size: 19 })] }),
    ], PALE, 150),
  ];

  spec.blocks.forEach((b) => {
    const fn = BLOCKS[b.type];
    if (!fn) throw new Error('unknown block type: ' + b.type);
    children.push(...fn(b));
  });

  // CTA
  children.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    borders: noBorders,
    margins: { top: 240 },
    rows: [new TableRow({
      children: [cell([
        p({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run('Questions? Let’s talk it through.', { font: SERIF, size: 26, bold: true, color: WHITE })] }),
        p({ alignment: AlignmentType.CENTER, spacing: { after: 70 }, children: [run('Call or text Terry direct   •   609-865-8811', { size: 24, bold: true, color: WHITE })] }),
        p({ alignment: AlignmentType.CENTER, children: [run('terry.thompson@westherr.com   •   ' + spec.url, { size: 17, color: 'C9D4E0' })] }),
      ], { width: CONTENT_W, shading: DARK, mt: 180, mb: 180 })],
    })],
  }));

  // Disclaimer + footer line
  children.push(p({ spacing: { before: 160 }, children: [run(spec.disclaimer, { size: 14, color: MUTED })] }));
  children.push(p({
    spacing: { before: 90 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: PALE, space: 6 } },
    children: [run('Terry Thompson  •  West Herr Chevrolet of Williamsville  •  Buffalo, New York  •  Not the dealership, Terry’s personal brand site.', { size: 14, color: MUTED })],
  }));

  return new Document({
    creator: 'Terry Thompson',
    title: spec.title,
    description: spec.metaDescription || spec.shortVersion,
    styles: { default: { document: { run: { font: SANS, size: 20, color: TEXT } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 900, right: 1080, bottom: 780, left: 1080 },
        },
      },
      children,
    }],
  });
}

const [specPath, outPath] = process.argv.slice(2);
if (!specPath || !outPath) {
  console.error('usage: node vehicle-guide-docx.js <spec.json> <out.docx>');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
Packer.toBuffer(build(spec)).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log('wrote ' + outPath);
});
