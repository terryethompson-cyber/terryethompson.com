# Vehicle guide print builder

Turns a vehicle-guide JSON spec into a print-ready PDF for showroom
use. The type, colors and section order match the guide pages on
terryethompson.com, so the handout and the web page read as the same thing.

Rendering goes through Chromium via Playwright, which is already a
devDependency for the browser tests. LibreOffice is not used and is not
required.

## Build one

```sh
npm install               # once, from the repo root (uses Playwright)
node vehicle-guide-pdf.mjs specs/equinox.json ../../Vehicles/print/2027-Chevy-Equinox-Guide.pdf
```

## Build all of them

```sh
for s in specs/*.json; do
  name=$(basename "$s" .json)
  node vehicle-guide-pdf.mjs "$s" "../../Vehicles/print/$name.pdf"
done
```

## Spec format

Top level: `title`, `heroLine`, `url`, `shortVersion`, `blocks`, `disclaimer`.

`blocks` is an ordered list. Each entry has a `type`:

| Type | Renders as | Fields |
|---|---|---|
| `heading` | Blue eyebrow, serif heading, rule | `label`, `heading`, optional `sub` |
| `paras` | Body paragraphs | `items` (array of strings) |
| `bullets` | Bulleted list, bold lead-in | `items` (array of `[lead, rest]`) |
| `trims` | Trim table | `rows` (`name`, `tag`, `desc`, optional `price1`/`price2`), optional `priceHeads` |
| `timeline` | Three availability cards | `cards` (`k`, `v`, `note`) |
| `specs` | Tinted number cards | `cards` (`big`, `small`) |
| `recs` | Recommendation cards | `cards` (`h`, `body`) |
| `note` | Small italic caveat line | `text` |

Omit `priceHeads` on a `trims` block and the price columns disappear, which is
what the Tahoe and Silverado specs do while pricing is unpublished.

## House rules

The same ones the web guides follow. No em dashes. Short sentences. The phone
number is 716-932-4793. Say when a number is unpublished instead of estimating
it.
