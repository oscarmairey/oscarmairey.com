# oscarmairey.com

Next.js (App Router) on the front, Postgres behind it, one password in front of
an editor at `/admin`.

Notes, books and companies are one table with three labels, edited from the
browser, the bio included: it is a row in `settings`, edited at `/admin` where
the home page prints it. What is left in `src/content` — the links, the
descriptions search engines quote — still changes with a deploy.

## Local

```sh
npm install
npm run dev            # http://127.0.0.1:3000
npm run db:migrate     # apply pending migrations
npm run db:migrate -- --status
```

`.env.local` holds the three secrets and is git-ignored:

```
DATABASE_URL=postgresql://oscarmairey:…@127.0.0.1:5432/oscarmairey
ADMIN_PASSWORD_HASH=scrypt:16384:8:1:…:…
SESSION_SECRET=…                       # 32 characters or more
UPLOADS_DIR=…                          # optional; ./uploads by default
```

Generate the last two — and a password, if you want one invented for you:

```sh
node scripts/hash-password.mjs 'the new password'
node scripts/hash-password.mjs            # invents one and prints it once
```

The password itself is never stored anywhere but your password manager.
Changing `SESSION_SECRET` signs every session out.

## Checks

```sh
npx tsc --noEmit        # types
npm test                # the editor, in a browser
```

`npm test` drives the real editor with Playwright: it writes, publishes,
unpublishes and deletes. So it never touches the site. `scripts/test.mjs`
stands up an instance that exists for the length of the run and takes it down
afterwards:

| | |
|---|---|
| database | `oscarmairey_test`, dropped and re-migrated before every run |
| build | `.next-test`, kept between runs and rebuilt only when the code changed |
| uploads | `.test/uploads`, wiped with the run |
| password | invented per run, unrelated to the real one |
| port | 3102 on the loopback, with no proxy in front of it |

It is also a guest on the machine. This box has four cores and is already
running the dev server, the live site, Postgres and an editor, so the suite
builds once and reuses that build — keyed on HEAD plus every uncommitted change
that could alter it — runs the build and the server at the lowest priority the
scheduler offers, holds the build to one worker and a 1 GB heap, keeps
Playwright to a single browser with one page and one flow at a time, and
refuses to start at all if less than 1.5 GB of memory is available.

Building once rather than compiling on demand took a full run from about six
minutes to a little over two, and left 2.7 GB free at its lowest point where
the old one left 1.4 GB. A run that changes no code pays no build at all.

Because the database is rebuilt from the migrations each time, the suite starts
from the same content on every run and has nothing to clean up. The suite
refuses to start if it is pointed anywhere else — at a hostname, at port 3100 or
3101, or at a database not named `oscarmairey_test` — and it refuses before it
loads the browser, so a wrong target is turned away whatever is installed.

The test database is made once:

```sh
docker exec xtrapoll-db-1 psql -U xtrapoll -d postgres \
  -c 'CREATE DATABASE oscarmairey_test OWNER oscarmairey'
```

There is no linter. `next lint` was removed in Next 16, and `eslint-config-next`
16 crashes on a circular import, so the whole stack was doing nothing but
sitting in package.json. TypeScript is the check until that is fixed; worth
revisiting at the next Next upgrade.

## Migrations

Every `.sql` file in `migrations/` is applied once, in filename order, each in
its own transaction, and recorded in `schema_migrations`. To add one, write the
next numbered file and run `npm run db:migrate`. There is no ORM and nothing
generated.

## Database

Postgres runs in the `xtrapoll-db-1` container. The site has its own database
and its own non-superuser role, both named `oscarmairey`; the role owns nothing
outside that database.

That container publishes port 5432 to the **host's loopback only**, which a
container cannot reach through `host-gateway`. So the site joins the database's
own network instead — `docker-compose.yml` declares `xtrapoll_default` as an
external network — and connects to the container on its internal port:

```
DATABASE_URL=postgresql://oscarmairey:…@xtrapoll-db-1:5432/oscarmairey
```

From the host (local development) the same database is at
`127.0.0.1:5432` instead.

## Deploy

```sh
# once, on the server: the secrets, with the container-side DATABASE_URL above
vim .env.production        # git-ignored, never in the image

docker compose build
docker compose up -d
docker compose exec web node scripts/migrate.mjs
```

Caddy terminates TLS and proxies to `127.0.0.1:3100`, which is the only port the
container publishes. The build never opens a database connection, so no
`DATABASE_URL` is needed to build the image — only to run it.

Uploaded images live in the `uploads` volume, mounted at `/app/uploads`. It is
outside the image on purpose: `public/` is copied in at build time, so anything
written there would be thrown away by the next `docker compose build`. Back the
volume up with the database, not with the repository.

## The site survives a dead database

Public reads go through a 30-second in-memory cache. When Postgres is
unreachable the last good answer is served instead; if the process has never
reached it, lists come back empty and the pages render as empty pages. A stopped
database costs freshness, not availability — it never produces a 500. The editor
is the opposite on purpose: it says plainly that the database is down rather
than show a stale copy of a post about to be overwritten.

## The editor

`/admin`, one password, session in a signed httpOnly cookie that expires on its
own after thirty days; there is no sign-out. Login is rate limited per client. Nothing under `/admin` is indexed: the pages are `noindex`,
`robots.txt` disallows it, and the sitemap lists public routes only.

One list and one page serve all three labels: `/admin/notes`, `/admin/books`,
`/admin/companies`, then `new` or the row's id under each. What a label does
differently — its fields, its words, its route — is in `src/lib/labels.tsx`.

You edit the page itself. The editor mounts the same component the public route
mounts and makes its text editable in place, so there is nothing to preview.
Enter starts a paragraph, Backspace at the start of one joins it to the last,
and a right click — or a selection, on a phone — offers heading, quote,
sidenote, emphasis and link. No editor library: `src/app/admin/editable.tsx` is
all of it.

Images are pasted, dropped on the page, or picked from the right-click menu.
The browser shrinks them first — 1600px on the long edge, webp at 0.85, GIFs
untouched — because the server has no processing library. What it sends is
stored as it arrives under `UPLOADS_DIR`: `./uploads` here, a Docker volume in
production, never `public/`, which the build would overwrite. They are served
from `/media/<name>`. An entry that stops mentioning a file takes it with
it.

Slugs and reading times are never typed: both are derived when you save, and
the slug follows the title until the entry is first published and then stays
put.

The order of a list is typed by hand, or rather dragged. Every row in the
editor's lists has a grip on its left — four dots, made for a thumb as much as
a cursor — and the order they end up in is the order the site reads, drafts
included. A new entry appears at the top.

Everything is a draft first, whatever its label: invisible to everyone else,
saving itself as you type. Publishing is a deliberate press, and so is any edit
to something already published. Unpublishing takes it back off the site without
losing it.

What is typed is stored in the same small format under every label:

```
## heading
> quote            (a closing `> — Source` line names it)
[^1]: sidenote     (floated beside the paragraph carrying [^1])
[label](url)       *emphasis*
```
