# Woven — web

The public site and dashboard preview for Woven, the private household computer. Next.js 16 (App Router), React 19, Tailwind v4, pnpm 10.

## Run

```bash
pnpm install          # slow on the external drive, see the ExFAT note
cp .env.example .env.local   # optional; defaults work for local development
pnpm dev              # http://localhost:3000
```

Environment (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public origin used by `robots.txt`, `sitemap.xml`, the web manifest and absolute metadata URLs. |
| `NEXT_PUBLIC_MAIL_DOMAIN` | Domain for the `hello@`, `support@`, `press@` addresses. Defaults to the site host. |

## Check

| Command | What it does |
| --- | --- |
| `pnpm lint` | ESLint (`eslint-config-next` core-web-vitals + TypeScript). |
| `pnpm typecheck` | `tsc --noEmit` over the whole app, tests included. |
| `pnpm test` | Vitest unit tests in `tests/unit` (jsdom + Testing Library). `pnpm test:watch` keeps them running. |
| `pnpm test:e2e` | Playwright (Chromium) in `tests/e2e` against `http://localhost:3000`. Reuses a running dev server, otherwise starts one. |
| `pnpm build` | Production build. |

First time only, install the browser Playwright drives:

```bash
pnpm exec playwright install chromium
```

The e2e suite covers every route in the sitemap (200, `<h1>`, title, no console errors), `/dashboard` redirecting a signed-out visitor to `/login`, the passkey sign-in flow, the configurator total, the mobile viewport having no horizontal overflow, and the platform files (`robots.txt`, `sitemap.xml`, `manifest.webmanifest`, icons).

CI (`.github/workflows/ci.yml` at the repo root) runs lint, typecheck, unit tests, build, then the e2e suite against `next start`.

## Screenshot QA

`scripts/shoot.mjs` drives the locally installed Google Chrome through `puppeteer-core` and writes a full-page screenshot plus one per section anchor:

```bash
node scripts/shoot.mjs <outDir> <url> [ids,comma,separated] [width] [height]

pnpm qa                                                        # home page: hero, sides, tandem at 1440x900
node scripts/shoot.mjs shots http://localhost:3000/core-pro hero,specs 390 844
SESSION=1 node scripts/shoot.mjs shots http://localhost:3000/dashboard   # with a simulated session
```

The dev server must already be running.

## Layout

- `src/app` — routes. `(marketing)` is the public site, `(auth)` sign-in and sign-up, `dashboard` the household shell. Root-level `icon.tsx`, `apple-icon.tsx`, `robots.ts`, `sitemap.ts`, `manifest.ts`, `loading.tsx`, `error.tsx` and `global-error.tsx` are the platform layer.
- `src/components` — shared UI, including the Three.js scenes under `three/`.
- `src/lib` — content and data: `site.ts` (tiers, nav, prices), `brand.ts` (site URL, addresses), `auth.ts` (client-side session preview).
- `tests/unit`, `tests/e2e` — Vitest and Playwright suites.

## ExFAT note

The repo lives on an ExFAT volume. That means:

- pnpm cannot hard-link, so `pnpm install` copies every package. Expect several minutes.
- macOS writes `._*` AppleDouble sidecars next to every file. ESLint, Vitest and Playwright are configured to ignore them; `next.config.ts` serves unoptimized images in development for the same reason. If a tool trips on a `._something` file, delete the sidecar, not the file.
- The Playwright browser cache is in `~/Library/Caches/ms-playwright`, off the volume, so it is unaffected.
