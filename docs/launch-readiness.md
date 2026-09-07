# Launch readiness

Version 0.1, 2026-09-06. An honest ledger of what is built, what is tested, and what stands between this and a public launch. Nothing on the site may say more than this page does.

## Try it on a Mac, with nothing installed

```bash
packaging/try.sh --seed
```

Builds the Core and the dashboard from the checkout, keeps data in `~/Library/Application Support/Woven Try` (delete it to start over), keeps the household key in a file there rather than the Keychain, and runs in the foreground until Ctrl-C. Open http://localhost:4002/login (the demo owner signs in with the recovery code `demo-house`, then `demo-key-1`…). Other devices at home open http://woven.local:4001 once to trust the certificate.

The service install (`packaging/install.sh`) is the real thing: a login service, the Keychain, signed releases. It needs the release key first (below).

## What a household can do today, on a Mac

| Area | State | Tested by |
| --- | --- | --- |
| Set up a house, passkeys, recovery and rescue codes, invitations, guests, screen code | built | `test/identity.test.ts`, `test/rights.test.ts`, live e2e |
| Files: upload, browse, move, share links, quotas, search | built | `test/files.test.ts`, `test/search-shares.test.ts`, live e2e |
| Photos: import, timeline, thumbnails, search by content (model through the Gate) | built | `test/photos.test.ts`, `test/models.test.ts`, live e2e |
| Media: probe, library, play with ranges, transcode | built | `test/media.test.ts`, live e2e |
| Home: simulated devices, actions with receipts, approvals, routines, presence | built on a simulated adapter; real radios arrive with the box | `test/actions.test.ts`, `test/routines.test.ts`, live e2e |
| Ask: rules over the box's data; no language model yet | built, honest about its limits | `test/ask.test.ts` |
| Cameras, Network hardware, agents runtime | not on a Mac; the pages say so when connected | live e2e |
| The Gate: allow list, open/closed, crossings with receipts, binary bodies | built | `test/gate.test.ts` |
| Encryption at rest, device-bound sessions, rate limits, contract over every route | built | `test/data-layer.test.ts`, `test/contract.test.ts` |
| Remote access through the relay, end to end encrypted | built; the relay is not deployed | `test/remote.test.ts` |
| Notifications through the Gate; urgent alerts to adults | built | `test/gate.test.ts`, `test/push.test.ts` |
| Backups: nightly snapshots, second location, restore drill, `woven-backup` client, device tokens | built | `test/ops.test.ts`, `test/integrity.test.ts` |
| The kill switch: off closes the Gate, drops the relay, stops jobs, refuses every route but itself; survives a restart | built | `test/power.test.ts`, live e2e |
| Signed releases, verifying installer, update with rollback | built; no release key yet | Release workflow (refuses unsigned) |
| Accessibility: axe on the public pages and login, reduced motion | built; serious findings fail the build | `tests/e2e/a11y.spec.ts` |
| Languages: English complete, German partial | layer built | `tests/unit/i18n.test.ts` |

## What the site says

Every measurable claim on the public site is a row in `apps/web/src/lib/claims.ts` with a status:
running today, waiting on the box, or a target with nothing measured behind it. The footnotes at
the foot of each page and the `/status` page both render from that file, and a unit test refuses a
footnote marker that cites a claim the page did not declare or that does not exist. The landing
page leads with what a household can run tonight, tags every section that needs hardware, and says
in the hero that the box is not built and a reservation takes no money. The privacy policy opens
by saying that no Woven service holds anything, because none is running.

`docs/claims-register.md` stays the review process with owners and dates. The code registry is what
a visitor sees, and the two must agree before a release.

## What stands between this and a public launch

1. **A release key.** `node packaging/keygen.mjs`, commit the public key, set `WOVEN_RELEASE_KEY`. Until then no release can be published and the hosted installer cannot verify anything.
2. **Deployments.** A Railway token for the public site (`apps/web/Dockerfile`), the relay (`apps/relay`) and the site API (`apps/site-api`, with a volume at `/data`). None is deployed; the site still serves from wherever it was last put.
3. **A relay address in the installer's default config**, once the relay is up, so remote access can be switched on without editing a file.
4. **Email.** A Resend key on the site API, or reservations and applications are stored but never confirmed by mail.
5. **A language model on the box.** Ask is rules today and says so. The site's Tandem copy is ahead of the software; it is labelled preview on every screen that is not real.
6. **An external penetration test** of the Core, the relay and the tunnel before strangers point browsers at it.
7. **Hardware.** Cameras, radios, the screen and the Outside processor are the box's. On a Mac the pages say what is missing rather than pretending.
8. **Public repository or hosted installer.** While the repository is private, `curl | bash` needs a signed-in `gh`. The Mac page leads with the source path for that reason.
9. **The reservation and application forms reach nobody** until the site API is deployed and the
   site build is given its address. Both now say so on screen rather than promising a place is
   held.

## How to run everything

```bash
pnpm -r typecheck && pnpm -r lint && pnpm -r test     # every package
cd apps/web && LIVE_CORE=1 pnpm exec playwright test   # the dashboard against a real Core (about 10 minutes)
```

Run the Playwright suite on an otherwise idle machine; under a parallel build the Core's Gate can miss its start-up deadline and the run reports that instead of testing anything.
