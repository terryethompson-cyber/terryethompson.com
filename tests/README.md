# Site checks

Automatic checks that run every time the site changes, so broken links get
caught here instead of by a customer.

## What gets checked

**Every link goes somewhere real.** Buttons, nav items, images, the booking
calendar — all of it. If a link points at a page that isn't there, the check
fails and tells you which file and which line.

**Capital letters match.** This one is easy to miss. A Mac treats `Vehicles`
and `vehicles` as the same folder, so a link with the wrong capitalisation
works perfectly on your laptop — and then 404s on the live site, because the
web server is stricter. The check compares against the real folder names, so
it catches this before it ships.

**Every page can be reached.** If you add a page and forget to link to it from
anywhere, nobody can find it and neither can Google. The check flags it.

**Phone and email links are valid.** Every `tel:`, `sms:` and `mailto:` link
is checked for a usable number or address.

**Section links point at real sections.** If a link goes to `page.html#specs`,
the check confirms `page.html` actually has a section marked `specs`.

Links to *other* websites (West Herr, the Google review page) are checked too,
but only once a week. Those depend on someone else's server being up, and a
slow afternoon at West Herr shouldn't stop you publishing.

## Running them yourself

You don't have to — GitHub runs these automatically on every change, and
you'll get an email if something breaks. But if you want to check before
publishing:

```
npm test
```

That's it. Nothing to install.

## When something fails

The output tells you the file, the line number, and what's wrong. For example:

```
Vehicles/2027-chevy-tahoe.html
  line 8   Capitalisation does not match the real file
    href="https://terryethompson.com/vehicles/2027-chevy-tahoe.html" —
    points at "vehicles/2027-chevy-tahoe.html", but on disk it is
    "Vehicles/2027-chevy-tahoe.html". This works on a Mac and 404s on
    the live site.
```

Fix the line it names, and the check goes green.

## Adding a page that shouldn't be linked

Some files are building blocks rather than real pages —
`brand-spine-snippet.html` is one. Those are listed in `NOT_PAGES` near the top
of `check-links.mjs`, so they aren't reported as unreachable. Add to that list
if you create another one.

## Files here

| File | What it does |
|---|---|
| `check-links.mjs` | The main check. Runs on every change. |
| `check-external.mjs` | Checks links to other websites. Runs weekly. |
| `self-test.mjs` | Checks that the checker itself still works. |
