# Site checks

Automatic checks that run every time the site changes, so problems get caught
here instead of by a customer. You don't have to run anything — GitHub runs
them for you and emails you if something breaks.

## What gets checked

### Links go somewhere real

Buttons, nav items, images, the booking calendar. If a link points at a page
that isn't there, the check fails and names the file and line.

**Capital letters match.** A Mac treats `Vehicles` and `vehicles` as the same
folder, so a link with the wrong capitalisation works on your laptop and then
404s on the live site. The check compares against the real folder names.

**Every page can be reached.** Add a page and forget to link to it and nobody
can find it — not customers, not Google. The check flags it.

### Buttons and forms actually work

A real browser drives the site the way a customer would:

- Paste a vehicle link, tap **Text It to Terry**, and confirm the link is
  actually in the message. *(This is the one that matters most — for months
  that box silently threw away whatever was pasted into it.)*
- Pressing Enter in that box sends.
- The booking calendar is really embedded and points at Google Calendar.
- Every call and text link is your real number.
- On a phone, the menu isn't hidden behind the sticky header.

### Pages are shareable, findable and quick

- Every page has a title, a description, a proper web address and a tab icon.
- Every page has the tags that make a **preview card** appear when you text or
  post the link — title, description and your photo, instead of a bare grey
  address.
- The sitemap matches the pages that actually exist.
- Your phone number and business name are identical everywhere. Google's local
  search rewards that consistency and punishes drift.
- No oversized images, and unused heavy files get flagged.
- Every image has alt text and every page has one main heading.

### Links to other websites

West Herr, your Google review page, the booking calendar. Checked **weekly**,
never on a normal change, because those depend on someone else's server being
up and shouldn't stop you publishing.

## Running them yourself

```
npm test
```

That covers links and page quality, with nothing to install.

To also drive the browser (needs a one-time `npm install`):

```
npm run test:browser
```

## After adding a page

Rebuild the sitemap, or the checks will tell you it's stale:

```
npm run sitemap
```

## When something fails

The output names the file, the line and what's wrong:

```
Vehicles/2027-chevy-tahoe.html
  line 8   Capitalisation does not match the real file
    points at "vehicles/2027-chevy-tahoe.html", but on disk it is
    "Vehicles/2027-chevy-tahoe.html". This works on a Mac and 404s
    on the live site.
```

Fix the line it names and the check goes green.

**Problems** fail the build. **Worth a look** items don't — they're advisory.

## Adding a page that shouldn't be linked

Some files are building blocks rather than real pages —
`brand-spine-snippet.html` is one. Those live in `NOT_PAGES` at the top of
`build-sitemap.mjs`. Add to that list if you make another.

## Files here

| File | What it does |
|---|---|
| `check-links.mjs` | Links and page reachability. Every change. |
| `check-pages.mjs` | Titles, previews, sitemap, image sizes. Every change. |
| `browser.test.mjs` | Drives a real browser through the buttons. Every change. |
| `check-external.mjs` | Links to other websites. Weekly. |
| `build-sitemap.mjs` | Rebuilds `sitemap.xml`. |
| `self-test.mjs` | Proves the link checker itself still works. |
