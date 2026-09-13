# Contributing to Woven

Woven is a private household appliance. The public parts — the marketing site,
its small API, and the relay — run on Railway and deploy from `main`. The Core,
which holds a household's actual data, is never deployed by us: each household
runs it on their own machine, and nothing in this repo reaches into anyone's
house.

## The loop

1. Branch from `main`. Name it for what it does, not who you are.
2. Make the change. Keep it to one thing.
3. Run the same checks CI runs, so you are not waiting on a runner to tell you
   what your laptop could have:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   ```
4. Open a pull request. The template asks three questions; answer them.
5. CI runs: a secret scan, the Core suite on macOS, the web suite with
   end-to-end tests against a real Core. All three must be green.
6. A maintainer merges. **Merging to `main` is deploying.** There is no
   staging step between the merge button and a household's browser.

Branch protection is not available on this repository's plan, so nothing
mechanically stops a merge with red checks. Do not merge red. If a check is
flaky, fix the flake or say so in the PR; do not re-run until it passes.

## Where things run

| Path | Deploys to | On |
| --- | --- | --- |
| `apps/web` | https://woventechnology.com | every merge to `main` |
| `apps/site-api` | https://api.woventechnology.com | every merge to `main` |
| `supabase/migrations` | the Supabase project | every merge to `main`, by Supabase's integration |
| `apps/relay` | wss://relay.woventechnology.com | every merge to `main` |
| `apps/core` | a household's own machine | when *they* update, via a signed release |
| `apps/core` (as `demo-core`) | https://demo.woventechnology.com | every merge to `main`. The example house: the same Core, `WOVEN_DEMO=on`, wiped and reseeded on every start. Nobody's data, ever |
| `packages/*` | wherever they are imported | with the app that imports them |

## Secrets

There are none in this repository, and there must never be. Every key the
deployed services need lives in Railway's variables for that service. If a
change needs a new secret, add it to Railway and read it from `process.env`;
do not put a placeholder, an example value, or a "temporary" real one in a
file. CI runs gitleaks on every push and fails on anything that looks like a
credential. `.env` files are ignored by git; keep them that way.

## Local development

Node 22 and pnpm. Then:

```bash
pnpm install
pnpm dev          # every app, in parallel
pnpm test         # unit tests, workspace-wide
```

To see the dashboard against a real Core on this machine without installing
anything:

```bash
packaging/try.sh --seed
```

## Changing the database

`apps/core/src/db/schema.ts` is the schema. If you change it, generate the
migration and commit both the SQL and the snapshot it produces:

```bash
pnpm --filter ./apps/core db:generate
```

CI fails if the schema and the checked-in migrations disagree. Do not write
migration SQL by hand; the snapshot is what lets the next person's generate
produce the right diff.

## Changing the site's database

The public site keeps accounts, reservations, applications and contact notes
in Supabase. Its schema is `supabase/migrations/`, one timestamped SQL file per
change, and merging to `main` applies them through Supabase's GitHub
integration. Nobody edits the live database by hand.

To add one:

```bash
supabase migration new what_it_does      # makes supabase/migrations/<stamp>_what_it_does.sql
```

Write the SQL, and remember that every table gets row security turned on and
policies that let a person read only their own rows. The site API writes with
the service key; signed-in people never insert, update or delete directly.

What must never go in here: anything from inside a house. Files, photos,
cameras, memory, the passkeys that open them — a Core keeps those in its own
encrypted database on the household's machine. This is the part of Woven that
exists before a box does.

## Style

The code has a voice. Comments explain why, not what. Names say what a thing
is for. A tutorial, an empty state, a note to the user — all of it is written
as if to a person who is intelligent and busy. Match what is around you.
