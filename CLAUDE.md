# Oscar Mairey — Personal Website

A personal index: who Oscar is, what he has written, what he has read, what he has built.
Content-first. The design gets out of the way and stays out of it.

## Who reads this

Investors, operators and qualified strangers running passive due diligence after a search,
an intro email or a LinkedIn profile. They read for ninety seconds and decide whether to
write. A second, slower audience comes back for the notes.

## Editorial rules (non-negotiable)

- **Oscar's age never appears, in any form, anywhere.** Dated experience is enough; the
  reader does the arithmetic and their conclusion is worth more than ours.
- A claim is dated, numbered, named, or it does not exist.
- The company is **Ko Social Network**, never "KOKO".
- ARTE One is the first company in the record and is described only there and on its own
  page. No positions, counterparties or capital.
- English only. No em dashes anywhere in copy.
- No contact section: the footer carries three links and an address, and that is all. No
  photograph, no "last updated" line, nothing that has to be kept true by hand.
- No decorative metadata. No "Founder / Dubai / Building since 2021" tag line, ever. No
  "Index" label on the home page.
- Text is written by Oscar. An unpublished entry is out of the site entirely, whatever its
  label: listings, sitemap, feed and its own address.
- Nobody types a slug or a reading time. Both are derived, from the title and from the
  body. The slug follows the title while an entry is a draft and freezes at its first
  publish: a published address never moves.
- The order of every list is Oscar's, dragged by the grip on the left of each row in the
  editor. A new entry starts at the top and is moved from there.
- A book is a title, its author and the one sentence that says why it stayed. Never a
  summary of the book.

## Architecture

Three lists, one shape. A note, a book and a company are the same kind of thing with
different metadata, so they are one table, one list component, one page component and one
editor. Adding a fourth label is a row in `src/lib/labels.tsx` and three files.

| Route | Content |
|---|---|
| `/` | Bio, then the five newest of each list, titles and metadata only |
| `/notes` | Every published note |
| `/notes/[slug]` | One note, with sidenotes |
| `/books` | Books finished, with the reason each one stayed |
| `/books/[slug]` | One book |
| `/companies` | The record, current company first |
| `/companies/[slug]` | One company |

Everything the site lists lives in one Postgres table, `writings`, with a `label` column
constrained to `note`, `book` or `company`. What a row holds is what makes it that entry and
nothing that is written in it: `slug`, `published`, `published_at`, `position`, `created_at`,
and `live_version_id`. Everything starts as a draft, whatever its label, and is published by
a press. `url` is still in the table and is read by nothing: a company's link left the site
and the one row that had one kept it.

**An entry can be written more than once.** What it says is a version of it, in
`writings_versions`: `entry_id`, `n` (v1, v2, v3, per entry, never reused), then `title`,
`subtitle` (the one line the lists print), `byline` (a book's author, a company's role),
`body`, `period` and `reading_time`, which is derived per version because two versions are
two lengths. Exactly one version is live, and the live one is the only thing a reader ever
sees — the page, the home page, the lists, the feed, the sitemap, `llms.txt`, `/md/`. Which
one that is, is a press of its own, weighed the same as Publish: not the newest, not the one
last typed into. Every public read is one inner join to `live_version_id` and knows nothing
about the rest.

Publishing stays the entry's, and so does the address: the slug follows the live version's
title while nobody can reach the entry, and freezes at the first publish. Retyping a version
that is not live moves nothing.

**Nothing deletes an entry.** Unpublishing takes it off the site and keeps it, which is what
taking something down means; there is no press, no server action and no query that removes a
row from `writings`. A version that is not the live one can be thrown away, which is as much
as anything here destroys — and never the live one, a rule the SQL enforces rather than the
browser, so the address always has words behind it. An entry with one version has only its
live one, so it cannot be emptied.

Every list is ordered by hand: a `position` column, lowest first, dragged into place in the
editor and read the same way by the site. It was derived from dates once; the record is not
the order it happened in, and only Oscar knows the difference. A new entry is inserted at
the top. Drafts hold their place among the published, so publishing one does not move it.

Two routes exist for uploaded images: `POST /admin/media` takes one in behind the editor's
session, and `GET /media/[name]` serves it off disk. See Images below.

What differs between the three labels — the word the nav prints, the route, the metadata a
list line carries, the metadata a page carries, the fields the editor shows — is in
`src/lib/labels.tsx` and nowhere else. `src/components/site/entries.tsx` is the only list on
the site and `src/components/site/entry.tsx` the only page.

Bodies use a small block model (`p`, `h2`, `quote`, `note`, `list`, `image`) with a tiny
inline formatter in `src/lib/inline.tsx` supporting `[label](url)`, `**bold**`, `*italic*`,
`__underlined__` and `[^1]` note markers. A list is stored as its lines, each behind `* `.
No MDX toolchain. The home page's bio is a row in `settings`, edited on the hub at `/admin`
where the home page prints it; `site.bio` in `src/content/site.ts` is the fallback the page
uses if the database has never answered. What is left in `src/content` — the links, the
descriptions — still changes with a deploy.

The editor at `/admin` is one password and no chrome of its own. It sits inside the site's
shell, on the site's column, under the site's masthead: there is no second navigation.
`/admin/[section]` lists, `/admin/[section]/new` and `/admin/[section]/[id]` edit.

Editing happens inside the page. The editor mounts the same `<Entry>` the public route
mounts and hands it editable regions, so there is no form and no preview tab: the title, the
line under it and every block of the body are typed where they will be read. A right click,
or a selection, offers heading, quote, list, sidenote, image, bold, italic, underline and
link; Cmd or Ctrl with B, I, U and K reach the four that are text.
`src/app/admin/editable.tsx` is the whole of that machinery, dependency-free: it renders the
inline tokens live, reads them back as source, and keeps the caret still by writing a
region's content exactly once. The stored format never changes.

Whatever the page prints is typed on the page, in the place it prints. A company's period
and role are the stamp under its name, a book's author is the stamp under its title, and a
note's date is picked in the stamp where it is read. There is no metadata row anywhere and
no field that is not part of the page. Everything saves itself three seconds after the
typing stops, a draft and a page a reader is on alike, and the save names the version it was
typed into, so one composed just before a switch still lands where it was written.

Above the bar, one grey line names the versions: `v1 v2 live v3`, the one on screen in
oxide the way the nav marks the page you are on, the live one carrying the word `live`, and
a `+` at the end that copies the version on screen into a new one to write over. A version
that is not live carries a `Delete this version` at the far end of that line. `Make live`
appears beside `Publish` only when the version on screen is not the one readers get, which
is exactly when it means something. The bar says whether a save is in flight and nothing
else: whether a reader can see this is already on the button offering to publish it.

## Design system

Light only. There is no dark mode, no theme provider, no `dark` class. Everything lives in
`src/app/globals.css` as custom properties plus semantic classes; Tailwind is kept for its
preflight and a few utilities.

### Colour: paper, ink, one oxide red

Neutrals are tinted toward the accent hue, so nothing is a dead grey. Measured against
`--paper`, sRGB, WCAG 2.x:

| Token | OKLCH | Hex | On paper |
|---|---|---|---|
| `--paper` | `oklch(98.6% 0.005 62)` | `#fdfaf7` | page |
| `--rule` | `oklch(90% 0.009 58)` | `#e3ddd8` | hairlines (decorative) |
| `--rule-firm` | `oklch(78% 0.012 55)` | `#beb6b0` | underlines (decorative) |
| `--ink` | `oklch(23% 0.014 48)` | `#231b17` | **16.26:1** |
| `--ink-2` | `oklch(45% 0.015 48)` | `#5d534e` | **7.18:1** |
| `--ink-3` | `oklch(52% 0.015 48)` | `#716762` | **5.31:1** |
| `--oxide` | `oklch(48% 0.115 32)` | `#934132` | **6.63:1** |

Every text token clears AA on every surface it is used on. The old violet shadcn preset
failed that test and is gone, along with `--radius: 1rem`. Radius is 0 everywhere.

**The accent has a job.** Oxide marks the current nav item, links inside prose, the email
address, hover and focus states, and the text selection. It is never a filled button, a
heading, a section background, an icon or a border.

### Typography: one family, four sizes, three weights

**Literata**, loaded through `next/font/google`, for everything: body, headings, navigation,
dates, notes, the email address. It was drawn for long-form reading on screens and carries
an optical-size axis, so 14px metadata and a 34px title are served by different cuts of the
same face. There is no second family and no icon font.

| Token | Size | Used by |
|---|---|---|
| `--t-s` | 0.9rem | dates, list lines, sidenotes, stamps, footer |
| `--t-m` | 17 → 19px | body, nav, list titles, subtitles |
| `--t-l` | 20.3 → 25.3px | section headings, article headings, running head |
| `--t-xl` | 25.3 → 33.8px | page titles only |

Weights: 400 body, 500 headings and list titles, 600 page titles. Inside prose, three marks
and no more: **bold** for a term being named, *italic* for a word being weighed, and an
underline in ink for the rare thing that is neither. An underline in oxide is a link and
nothing else. Scale ratio 1.333, fluid between a 360px and a 1280px viewport.

If you are adding a style and it does not map to one of those four sizes and three weights,
the answer is no. That discipline is the design.

### Layout and motion

One centred column, `--page: 44rem`, measure capped near 66ch. Sections are separated by a
single hairline. Sidenotes float into the right margin above 1240px and fall back to an
indented block inline below it.

Motion is limited to 120ms colour transitions on interactive elements. No entrance
animation, no scroll-triggered reveals, no animation library. Every page renders fully
without JavaScript; the masthead is the only client component on the public site, and only
because it reads the pathname.

## SEO and machine readers

`metadataBase`, per-route canonicals, OpenGraph and Twitter cards (`src/app/opengraph-image.png`,
regenerated from `assets/photo.png`), JSON-LD `Person` on every page and `Article` on a note,
`sitemap.ts`, a hand-written `robots.txt` and an RSS feed at `/feed.xml` carrying notes only.
Title template: `%s · Oscar Mairey`. A list page is in the sitemap only while something is
published on it: an empty page is worth less than no page at all in a map this short, and
the count is read rather than written down, so the list comes back the day it has an entry.
The page itself stays reachable and stays in the nav either way.

Half the audience is not a person. An investor running due diligence increasingly reads the
site through an assistant, and what that assistant quotes is what the reader gets. So the
site says the same thing in a form built for one, derived from the same cached content layer
as the pages: never staler than they are, and a draft is as absent there as anywhere else.

| Route | What it is |
|---|---|
| `/llms.txt` | the map: the bio, then every published entry as a link with its one line |
| `/llms-full.txt` | the same, with every body in full |
| `/md/[section]/[slug]` | one entry as markdown |

The block format was already most of the way there — `## `, `> `, `* `, `[label](url)`,
`**bold**`, `*italic*` and `[^1]` are what markdown calls them — so `src/lib/markdown.ts`
changes four things and copies the rest: image sources become absolute, `__underlined__`
becomes `<u>`, a typed line break becomes markdown's, and sidenotes move to the foot as
footnotes. Each entry page points at its markdown with
`<link rel="alternate" type="text/markdown">`, and every page points at the map with
`<link rel="alternate" type="text/plain" href="/llms.txt">`. Both are written from
`alternatesFor` in `src/lib/meta.ts` with the feed, because Next assigns `alternates` rather
than merging it and a page that names its own canonical would otherwise drop the lot.
The suffix is not on the entry's own address
because a dynamic segment cannot carry one, and the catch-all that would allow it stands in
front of the page it is meant to accompany.

`robots.txt` is written by hand rather than generated, so it can say something: nothing is
turned away but `/admin`, the map is pointed at in a comment, and the assistants — GPTBot,
ClaudeBot, PerplexityBot, Google-Extended, CCBot and the rest — are named one by one,
because a name absent from a block list is easy to miss and easy to doubt.

Social links are `github.com/oscarmairey`, `x.com/oscarmairey`,
`linkedin.com/in/oscarmairey` — no hyphen in any of the three. The old `cesarioo` handles
were wrong and are gone. All three open in a new tab; the email address does not.

## Images

Two kinds, and they must not be confused.

**The site's own picture.** `assets/photo.png` is kept only as the source of the generated
`src/app/icon.png`, `apple-icon.png`, `opengraph-image.png` and `twitter-image.png`. It is
never rendered on a page and never served: `assets/` is a build-time source, outside
`public/`, outside the image, and there is no second photograph anywhere.

**Editorial images.** Anything inside a note, a book or a company: uploaded through the
editor, and part of what is written. Paste one from the clipboard, drop it on the page, or
take Image from the right-click menu; it lands in the body as `![caption](name)`, which is
what the block model stores. They sit in the measure with no radius, no border and no frame,
and a caption, if there is one, reads at `--t-s` in `--ink-3`.

The files live in `UPLOADS_DIR` (`./uploads` in development, a Docker volume at
`/app/uploads` in production) and are served by `/media/[name]`, cached forever because a
name is only handed out once. They are deliberately **not** in `public/`: that directory is
copied into the image at build time, so anything written there would be lost on the next
deploy. The server has no processing library and never will: the shrinking happens in the
browser, before the upload, where there is a canvas and an encoder already. An image is
drawn down to 1600 on its long edge and re-encoded as webp at 0.85; a GIF is left alone so
its animation survives, an image already inside that and already webp or avif is left as it
is, and a re-encode that came out no smaller loses to the original. What arrives is what is
stored, up to 8 MB, in one of png, jpeg, webp, gif or avif. The size the browser measured is
baked into the name
(`stem-tag-1200x800.png`) so a page can reserve the box before the bytes arrive. A version
that stops referring to a file takes it with it, on save and when the version itself is
thrown away, unless some other version of some other entry still refers to it — a picture
only the version nobody is being shown mentions is still mentioned, and stays.

## Stack

Next.js 16 (App Router), React 19, Tailwind 3 for preflight, TypeScript, Postgres through
`pg`. Four runtime dependencies: `next`, `react`, `react-dom`, `pg`. Keep it that way;
`next-themes`, `framer-motion`, Radix, lucide, cmdk and the shadcn `ui/` components were all
removed.
