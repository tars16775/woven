# Woven

**One box for the whole house.** Files, photos, cameras, the smart home, the television, a private assistant called Tandem, and the household's Wi-Fi router, in one appliance. Internally it is an offline home data center; publicly it is never called that. Two computers share the chassis: the **Inside** holds everything of the household's and has no route to the internet; the **Outside** is the router on its own processor; the **Gate** between them forwards only what the household approves and records every crossing.

Everything in your world, woven together.

## Status

- Product definition is settled in [docs/product-definition.md](docs/product-definition.md).
- The website and dashboard frontend lives in `apps/web` (Next.js 16, Tailwind 4, Motion, react-three-fiber). Marketing site, product pages, order configurator, sign-in and sign-up, and the household dashboard are built against a typed mock data layer and a client-side mock session.
- The backend (identity, policy engine, capability gateway, activity ledger) is the next phase and will replace `apps/web/src/lib/dashboard/data.ts`.

## Run it

```bash
pnpm --dir apps/web install
pnpm --dir apps/web dev
```

Then open http://localhost:3000. The dashboard is at `/dashboard`.

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
