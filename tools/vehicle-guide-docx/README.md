# Vehicle guide print builder

Turns a vehicle-guide JSON spec into a print-ready Word document for showroom
use. The type, colors and section order match the guide pages on
terryethompson.com, so the handout and the web page read as the same thing.

The repo sets `"type": "module"`, so this script keeps the `.cjs` extension to
stay CommonJS. Renaming it back to `.js` will break it.

## Build one

```sh
npm install               # once, from the repo root
node vehicle-guide-docx.cjs specs/equinox.json ../../Vehicles/print/2027-Chevy-Equinox-Guide.docx
```

## Build all of them

```sh
for s in specs/*.json; do
  name=$(basename "$s" .json)
  node vehicle-guide-docx.cjs "$s" "../../Vehicles/print/$name.docx"
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
number is 609-865-8811. Say when a number is unpublished instead of estimating
it.
