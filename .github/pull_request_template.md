## What changed

## Why

## How I checked it

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass locally
- [ ] If `apps/core/src/db/schema.ts` changed: `pnpm --filter ./apps/core db:generate` was run and the migration is committed
- [ ] No secret, token or key is in the diff (CI runs gitleaks, but look anyway)

## Deploys

Merging to `main` deploys whatever this touches: `apps/web` → the site, `apps/site-api` → the API, `apps/relay` → the relay. The Core is not deployed by anyone; households run it themselves.
