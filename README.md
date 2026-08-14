# oscarmairey.com

Next.js (App Router) on the front, Postgres behind it, one password in front of
an editor at `/admin`.

Notes, books and companies are one table with three labels, edited from the
browser. What is left in `src/content` — the bio, the links — still changes with
a deploy.

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
They are stored as they arrive under `UPLOADS_DIR` — `./uploads` here, a Docker
volume in production, never `public/`, which the build would overwrite — and
served from `/media/<name>`. An entry that stops mentioning a file takes it with
it.

Slugs and reading times are never typed, and neither is an order. The slug and
the reading time are derived when you save — the slug follows the title until
the entry is published and then stays put — and a list is simply newest first.

Notes have a draft state and save themselves as you type; publishing is a
deliberate press, and so is any edit to something already published. Books and
companies are always live, so they save on a press.

What is typed is stored in the same small format under every label:

```
## heading
> quote            (a closing `> — Source` line names it)
[^1]: sidenote     (floated beside the paragraph carrying [^1])
[label](url)       *emphasis*
```
