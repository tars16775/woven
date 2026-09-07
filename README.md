# Woven

**One box for the whole house.** Files, photos, cameras, the smart home, the television, a private assistant called Tandem, and the household's Wi-Fi router, in one appliance. Internally it is an offline home data center; publicly it is never called that. Two computers share the chassis: the **Inside** holds everything of the household's and has no route to the internet; the **Outside** is the router on its own processor; the **Gate** between them forwards only what the household approves and records every crossing.

Everything in your world, woven together.

## Status

- Product definition is settled in [docs/product-definition.md](docs/product-definition.md).
- The website and dashboard frontend lives in `apps/web` (Next.js 16, Tailwind 4, Motion, react-three-fiber). Marketing site, product pages, order configurator, sign-in and sign-up, and the household dashboard are built against a typed mock data layer and a client-side mock session.
- The backend (identity, policy engine, capability gateway, activity ledger) is the next phase and will replace `apps/web/src/lib/dashboard/data.ts`.

## Layout

```
apps/web        the site and the dashboard (Next.js)
apps/core       the Woven Core service (Fastify), runs inside the house on :4000 (HTTPS) with the trust page on :4001
packages/schema shared Zod schemas and types for every boundary
packages/hal    hardware layer: what machine this is, honestly
packages/policy the deterministic action-risk engine
docs/adr        architecture decision records
docs/backend-plan.md  the 50 phases
```

## Try it on this Mac, nothing installed

```bash
packaging/try.sh --seed
```

Builds the Core and the dashboard from this checkout and runs them in the foreground with data in a folder you can delete. See [docs/launch-readiness.md](docs/launch-readiness.md) for what works today and what is still ahead of a public launch.

## Install it on a Mac (the service)

```bash
curl -fsSL https://raw.githubusercontent.com/tars16775/woven/main/packaging/install.sh | bash
```

That fetches Node and the newest release into `~/.woven`, installs a login service (`launchd`), and opens the setup page. While the repository is private the raw URL needs a signed-in `gh` (the installer falls back to it); the public site serves the same script at `/install.sh` once it is deployed. Data goes to `~/Library/Application Support/Woven` unless `WOVEN_DATA` says otherwise. Afterwards: `woven status`, `woven logs`, `woven config`, `woven update`, `woven uninstall`. The core serves the dashboard itself at `https://woven.local:4000` (and `http://localhost:4002` on the Mac), so there is one process and one address. Releases are built by `packaging/release.sh` and published by the Release workflow on a `v*` tag.

## Run it from source

```bash
pnpm install
pnpm dev            # site on :3000 and core on :4000
pnpm typecheck && pnpm lint && pnpm test

# The core keeps its database, object store and snapshots under WOVEN_DATA.
pnpm --filter ./apps/core snapshot                       # take a snapshot now
pnpm --filter ./apps/core restore <snapshot-dir> [root]  # restore into an empty data root
pnpm --filter ./apps/core db:generate                    # after editing apps/core/src/db/schema.ts
pnpm --filter ./apps/core seed                           # a demo household for development
pnpm --filter ./apps/core backup ~/Documents --owner you@example.com   # bring a folder onto the box (dedup by hash)
pnpm --filter ./apps/core photos "/Volumes/Woven/Photo export" --owner you@example.com   # import a photo library export

# End-to-end against a real core (Playwright starts one on :4000 with TLS off):
LIVE_CORE=1 pnpm --filter web test:e2e
```

The Gate runs as a separate process the core starts (`WOVEN_GATE=spawn`, port 4010, loopback only). Crossings may only reach hosts in `WOVEN_GATE_ALLOW`; every one asks first and leaves a receipt saying what was sent. Closing the Gate from the dashboard makes crossings fail cleanly.

The code on the box's screen lives at http://127.0.0.1:4002/v1/screen on the Mac itself (loopback only, so only someone at the machine can read it). Sign in on any device with your name and the six digits.

Photo search runs on the box: the Photos page offers "Turn on photo search", which downloads a small CLIP model (about 160 MB) through the Gate once the owner approves the crossing. The Gate's default allow list (`WOVEN_GATE_ALLOW=huggingface.co,*.hf.co`) exists for that download and nothing else.

Identity runs on the Core: `/signup` creates the household and the owner's first passkey (recovery codes are shown once), `/login` signs in with a passkey or a recovery code, and the session is an httpOnly cookie on the Core. Without a Core the pages fall back to the simulated preview.

The dashboard looks for a Core at `https://woven.local:4000`, then this machine (`http://localhost:4002`, the core's loopback listener). Until one answers it shows preview data and a "Connect to your Core" card on the Core page. Build the marketing deploy with `NEXT_PUBLIC_WOVEN_LIVE=off` so it never looks.

```bash
```

Or double-click `Start Woven.command` on the LaCie (it runs the core under `tools/woven-core.sh`, which restarts it when the dashboard asks). The site is at http://localhost:3000, the dashboard at `/dashboard`, the core at https://woven.local:4000/v1/health. On a new device open http://woven.local:4001 first and install the household certificate (ADR 0006); on this Mac double-click `Woven Data/keys/ca.crt`, then set its trust to Always in Keychain Access.

Visual QA screenshots (uses the locally installed Chrome):

```bash
node apps/web/scripts/shoot.mjs out http://localhost:3000/ tandem,core-pro
```

## Layers

| Layer | Role |
|---|---|
| Store | Files, backup, photos, media, camera archives. Local. |
| Connect | Smart-home brain. Matter, Thread, Zigbee. Device Graph. |
| Think | Local inference, Tandem, model router, approved cloud burst. |
| Govern | Identity, permissions, receipts, agent sandbox. The layer Woven owns. |

## Principles

The model is not a security boundary. Local first, cloud by permission. Every consequential action has a receipt. The chassis outlives the compute. The appliance keeps working when the subscription stops.

## Reference material

Planning documents (software PRD, hardware PRD, integrated MVP plan, business plan), the investor deck, and product mockups are kept alongside this repo as reference and are not committed. They are the long-range architecture map; the product definition above is the current scope.

## Where things live on this Mac

- The repo and all Woven data sit on an APFS volume, `/Volumes/Woven`, which is a sparse bundle image stored on the LaCie drive at `/Volumes/LaCie/Woven.sparsebundle`. It mounts on demand and grows as used, up to 1.5 TB.
- `/Volumes/Woven/Woven` is this repo. `/Volumes/Woven/Woven Data` is where the local Core service keeps its database, files and logs. `/Volumes/Woven/.pnpm-store` is the package store; `apps/web/.npmrc` points at it so installs hard-link instead of copying.
- Double-click `Start Woven.command` on the LaCie root to mount the volume, start the site (and the Core service once it exists) and open the dashboard. `Stop Woven.command` stops both and unmounts.
- The LaCie itself is ExFAT, which is why the repo does not live on it directly: no symlinks, no permissions, no journaling, and macOS litters it with `._*` sidecar files.
