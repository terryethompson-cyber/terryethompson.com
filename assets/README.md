# assets

## brand-band.css

Styles for the First Principles brand band — the horizontal four-pillar banner
that runs on every page. The markup lives in each page (search for
`brand-band`), the styling lives here, so a change here changes every page.

Three forms of the same band:

| Class                  | Where it is used                          | Why |
|------------------------|-------------------------------------------|-----|
| `brand-band`           | Vehicle guides, appointment page          | Full band: name, role, four pillars, call to action |
| `brand-band--compact`  | Home page, Google landing page            | Those pages introduce Terry directly above, so the band drops the name and keeps the pillars and the call to action |
| `brand-band--boxed`    | Car Math, Buying Tools, Video Playbooks   | Those pages are a fixed 800px column, so the band is a rounded card inside it rather than a full-width strip |

The four pillar buttons all point at the matching card on the home page
(`/#safety`, `/#affordability`, `/#lifestyle-fit`, `/#long-term-value`), so
every page on the site feeds the framework, and each card there hands the reader
on to a deeper page. The link checker fails if one of those anchors disappears.

## terry-banner.jpg — optional, not in the repo yet

The band looks for a photograph at `/assets/terry-banner.jpg` and lays a dark
scrim over it. **Nothing breaks while that file is missing**: the band falls back
to the Graphite and Charcoal Blue gradient, which is what it renders today.

To add the Silverado banner photograph:

1. Save it as `assets/terry-banner.jpg`.
2. Crop it wide — roughly 2000 x 500. The band shows the right-hand side of the
   image on wide screens, so keep the vehicle to the right and leave the left
   third quiet, because that is where the name sits.
3. Keep it under about 300 KB. It loads on every page, so weight is felt.

No code change is needed. Drop the file in and it appears.
