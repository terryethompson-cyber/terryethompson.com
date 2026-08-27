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
- The top of every page clears the fixed header at six screen widths — not cut
  off underneath it, and not sitting below a band of empty colour.

### Every page still pulls from the one shared file

`/site.css` and `/site.js` hold the header, the nav, the footer, the brand
colours and the phone rules. Before they existed, each new page was a
hand-copy of an older one, so a fix made after the copy was taken never
reached the copy. That happened three times: a guide shipped without the
menu-offset script, another without the **Vehicle Guides** link, a third
without the phone header rules — its header was 157px tall with the tagline
on five lines.

So the checks now hold the pages to it:

- Every page with a header links `/site.css` and loads `/site.js`.
- The header really arrives — checked by measuring the rendered colour, not
  by trusting the `<link>` tag.
- The header markup is the same block on every page, character for character.
- No page carries inline styles on its header. An inline style beats the
  shared file, so one would quietly put that page back out of reach.
- No page redefines the brand colours in its own `<style>`.
- The nav is the same set of links everywhere.

**What this means for you:** to change the header, the nav, the footer or a
brand colour, edit `site.css` once. It reaches every page. If you ever paste a
page's shell into a new file by hand, these checks will tell you.

### Small text is dark enough to read

Every piece of text on every page is measured against whatever is actually
behind it, and held to the standard readability bar (4.5:1, or 3:1 for large
text). This catches the grey that looks fine on a desktop monitor indoors and
goes thin on a phone in daylight — which is where your customers read it.

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
