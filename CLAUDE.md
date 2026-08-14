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
- Nobody types a slug, a reading time or an order. All three are derived: from the title,
  from the body, and from when a thing was made. The slug follows the title while an entry
  is a draft and freezes at its first publish: a published address never moves.
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
constrained to `note`, `book` or `company`. The columns are flat: `title`, `subtitle` (the
one line the lists print), `byline` (a book's author, a company's role), `body`, `period`,
`reading_time`, `published`, `published_at`, `created_at`. Everything starts as a draft,
whatever its label, and is published by a press. `year` and `url` are still in the table and
are read by nothing: a book's year and a company's link left the site, and their data stayed.

Nothing is ordered by hand. A list is newest first: a note by the day it was published,
everything else by the day it was made.

Two routes exist for uploaded images: `POST /admin/media` takes one in behind the editor's
session, and `GET /media/[name]` serves it off disk. See Images below.

What differs between the three labels — the word the nav prints, the route, the metadata a
list line carries, the metadata a page carries, the fields the editor shows — is in
`src/lib/labels.tsx` and nowhere else. `src/components/site/entries.tsx` is the only list on
the site and `src/components/site/entry.tsx` the only page.

Bodies use a small block model (`p`, `h2`, `quote`, `note`) with a tiny inline formatter in
`src/lib/inline.tsx` supporting `[label](url)`, `*emphasis*` and `[^1]` note markers. No MDX
toolchain. What is left in `src/content` — the bio, the links — still changes with a deploy.

The editor at `/admin` is one password and no chrome of its own. It sits inside the site's
shell, on the site's column, under the site's masthead: there is no second navigation.
`/admin/[section]` lists, `/admin/[section]/new` and `/admin/[section]/[id]` edit.

Editing happens inside the page. The editor mounts the same `<Entry>` the public route
mounts and hands it editable regions, so there is no form and no preview tab: the title, the
line under it and every block of the body are typed where they will be read. A right click,
or a selection on a touch screen, offers heading, quote, sidenote, emphasis and link.
`src/app/admin/editable.tsx` is the whole of that machinery, dependency-free: it renders the
inline tokens live, reads them back as source, and keeps the caret still by writing a
region's content exactly once. The stored format never changes.

Whatever the page prints is typed on the page, in the place it prints. A company's period
and role are the stamp under its name, a book's author is the stamp under its title, and a
note's date is picked in the stamp where it is read. There is no metadata row anywhere and
no field that is not part of the page. A draft saves itself as it is typed; anything a
reader can already reach saves on a deliberate press, and so does publishing it.

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

Weights: 400 body, 500 headings and list titles, 600 page titles. Italic for emphasis only.
Scale ratio 1.333, fluid between a 360px and a 1280px viewport.

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

## SEO

`metadataBase`, per-route canonicals, OpenGraph and Twitter cards (`src/app/opengraph-image.png`,
regenerated from `public/photo.png`), JSON-LD `Person` with corrected `sameAs`, `sitemap.ts`,
`robots.ts` and an RSS feed at `/feed.xml` carrying notes only. Title template:
`%s · Oscar Mairey`.

Social links are `github.com/oscarmairey`, `x.com/oscarmairey`,
`linkedin.com/in/oscarmairey` — no hyphen in any of the three. The old `cesarioo` handles
were wrong and are gone. All three open in a new tab; the email address does not.

## Images

Two kinds, and they must not be confused.

**The site's own picture.** `public/photo.png` is kept only as the source of the generated
`src/app/icon.png`, `apple-icon.png`, `opengraph-image.png` and `twitter-image.png`. It is
never rendered on a page, and no second one is ever added to `public/`.

**Editorial images.** Anything inside a note, a book or a company: uploaded through the
editor, and part of what is written. Paste one from the clipboard, drop it on the page, or
take Image from the right-click menu; it lands in the body as `![caption](name)`, which is
what the block model stores. They sit in the measure with no radius, no border and no frame,
and a caption, if there is one, reads at `--t-s` in `--ink-3`.

The files live in `UPLOADS_DIR` (`./uploads` in development, a Docker volume at
`/app/uploads` in production) and are served by `/media/[name]`, cached forever because a
name is only handed out once. They are deliberately **not** in `public/`: that directory is
copied into the image at build time, so anything written there would be lost on the next
deploy. Nothing is resized or re-encoded — the file is stored as it arrived, up to 8 MB, in
one of png, jpeg, webp, gif or avif. The size the browser measured is baked into the name
(`stem-tag-1200x800.png`) so a page can reserve the box before the bytes arrive. An entry
that stops referring to a file takes it with it, on save and on delete, unless another entry
still refers to it.

## Stack

Next.js 16 (App Router), React 19, Tailwind 3 for preflight, TypeScript, Postgres through
`pg`. Four runtime dependencies: `next`, `react`, `react-dom`, `pg`. Keep it that way;
`next-themes`, `framer-motion`, Radix, lucide, cmdk and the shadcn `ui/` components were all
removed.
