# Vehicle guide print builder

Prints the real guide pages to PDF for showroom use.

The handout **is** the page, printed. There is no separate print design, so
the paper version cannot drift from the web version: same hero, same trim
cards, same colours, same words. Add a guide page and it gets a matching
handout with no extra work.

## Build

```sh
npm install                                          # once, from the repo root
node tools/vehicle-guide-pdf/vehicle-guide-pdf.mjs   # every guide
```

Or one page:

```sh
node tools/vehicle-guide-pdf/vehicle-guide-pdf.mjs Vehicles/2027-chevy-tahoe.html
```

Output goes to `Vehicles/print/`, named to match what the site already links
to: `2027-chevy-tahoe.html` becomes `2027-Chevy-Tahoe-Guide.pdf`.

Re-run it after editing a guide page, or the handout will be a version behind.

A handout has to be something you can hand across a desk, so the budget is
three sheets. The builder prints the page count for each guide and exits
non-zero if one goes over, rather than letting it be discovered in the
showroom with the paper already printed.

## What changes for paper

Deliberately little. Everything the page already does is what we want printed.
The rules that get added are only the things paper cannot do:

| Rule | Why |
|---|---|
| Hide `.sticky-bar` and `.subnav-mobile` | The nav is fixed to the viewport and would stamp itself over every sheet |
| Hide `.print-bar` | A button offering this PDF, inside this PDF |
| Tighter section padding | Paper is shorter than a scroll |
| `break-inside: avoid` on cards | Never split a trim or spec card across a page |
| Zero side margins | Keeps layout above the 768px mobile breakpoint, and lets the dark hero bleed to the paper edge the way it does on screen |
| Footer with the phone number and page number | Paper has no address bar |
| Trim and engine cards go 4-up | The print canvas is wider than the web column, so the same cards sit in fewer rows |
| Printed at 0.75 scale | Lands every guide on three sheets, as large as it can print and still fit |
| Drop the Availability and Pricing sections | Both move faster than anything else on the page. Paper cannot be updated, and stale dates or stale numbers in a customer's hand are worse than none. Both stay on the web page. Edit `PRINT_DROP_SECTIONS` in the builder to change what comes out; sections are matched by their section label |

## Rendering

Chromium via Playwright, which is already a devDependency for the browser
tests. LibreOffice is not used and is not required.
