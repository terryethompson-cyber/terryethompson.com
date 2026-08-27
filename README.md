# terryethompson.com
Official professional website for terryethompson.com

## Editing the site

Page content lives in each page's own `.html` file.

**The parts every page shares — the header, the navigation, the footer, the
brand colours — live in `site.css` and `site.js`.** Edit those once and the
change reaches every page. Don't copy the header out of one page into another;
the checks will catch it, because pages drifting apart that way has broken this
site three times.

## Automatic checks

Every change to this site is checked for broken links, wrong capitalisation in
file paths, and pages nothing links to. This runs on GitHub automatically — you
don't have to do anything.

To run the checks yourself before publishing:

```
npm test
```

See [`tests/README.md`](tests/README.md) for what's checked and what to do when
something fails.
