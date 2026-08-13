# Oscar Mairey — Personal Website

A personal index: who Oscar is, what he has written, what he has read, what he has built.
Content-first. The design gets out of the way and stays out of it.

## Who reads this

Investors, operators and qualified strangers running passive due diligence after a search,
an intro email or a LinkedIn profile. They read for ninety seconds and decide whether to
write. A second, slower audience comes back for the writings.

## Editorial rules (non-negotiable)

- **Oscar's age never appears, in any form, anywhere.** Dated experience is enough; the
  reader does the arithmetic and their conclusion is worth more than ours.
- A claim is dated, numbered, named, or it does not exist.
- The company is **Ko Social Network**, never "KOKO".
- ARTE One appears in `currently` and nowhere else. No positions, counterparties or capital.
- English only. No em dashes anywhere in copy.
- No contact section: the footer carries three links and an address, and that is all.
- No decorative metadata. No "Founder / Dubai / Building since 2021" tag line, ever. No
  "Index" label on the home page.
- Text is written by Oscar. `draft: true` keeps an unwritten piece out of the site
  entirely: listings, sitemap and feed.

## Architecture

| Route | Content |
|---|---|
| `/` | Bio, five latest writings, books, condensed building record, footer |
| `/writings` | Every published writing |
| `/writings/[slug]` | One writing, with sidenotes |
| `/books` | Books finished, with the reason each one stayed |
| `/building` | Currently (dated), then the record, then code, then talks |

Content lives in `src/content/*.ts` as plain data, so a web editor can round-trip it later
without a parser. Writing bodies use a small block model (`p`, `h2`, `quote`, `note`) with a
tiny inline formatter in `src/lib/inline.tsx` supporting `[label](url)`, `*emphasis*` and
`[^1]` note markers. No MDX toolchain.

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
| `--t-s` | 0.9rem | dates, notes, sidenotes, hooks, roles, footer |
| `--t-m` | 17 → 19px | body, nav, list titles, authors, subtitles |
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
without JavaScript; the only client components are the masthead and footer, and only because
they read the pathname.

## SEO

`metadataBase`, per-route canonicals, OpenGraph and Twitter cards (`src/app/opengraph-image.png`,
regenerated from `public/photo.png`), JSON-LD `Person` with corrected `sameAs`, `sitemap.ts`,
`robots.ts` and an RSS feed at `/feed.xml`. Title template: `%s · Oscar Mairey`.

Social links are `github.com/oscarmairey`, `x.com/oscarmairey`,
`linkedin.com/in/oscar-mairey`. The old `cesarioo` handles were wrong and are gone.

## Images

`public/photo.png` is the only photograph on the site and appears once, in the home page
footer at 96px. Do not add more. `src/app/icon.png`, `apple-icon.png`, `opengraph-image.png`
and `twitter-image.png` are generated from it.

## Stack

Next.js 16 (App Router), React 19, Tailwind 3 for preflight, TypeScript. Three runtime
dependencies: `next`, `react`, `react-dom`. Keep it that way; `next-themes`,
`framer-motion`, Radix, lucide, cmdk and the shadcn `ui/` components were all removed.
