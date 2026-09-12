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

## Deployed

Railway project `woven`, in the `tars16775's Projects` workspace. Three services, each built from
its own Dockerfile in this repository and deployed with `railway up --service <name>`.

| Service | Address | Notes |
| --- | --- | --- |
| `site` | https://woventechnology.com | The public site. `NEXT_PUBLIC_WOVEN_LIVE=off`, so its dashboard never looks for a Core and says so plainly. |
| `site-api` | https://api.woventechnology.com | Reservations, applications, contact and pings, on a volume at `/data`. `ADMIN_TOKEN` is in the service's variables. |
| `relay` | wss://relay.woventechnology.com | Carries encrypted frames between a Core and its dashboards. Holds nothing. |

Custom domains are not attached: Railway refuses the request on this account, which is what it does
when the plan does not include them. Until then the site answers on its Railway address, and
`SITE_ORIGINS` on the API lists that address alongside the real domain.

## What stands between this and a public launch

Rewritten 2026-09-08, after the first real release was built and the install
path was rehearsed end to end for the first time.

**Done since the last revision.** Custom domains are available on the account
and all four are registered against their Railway services; `docs/dns/` holds
the zone, with CNAME targets taken from Railway's API. The install, update and
rollback path now has a test (`packaging/rehearse.sh`, 23 checks) and it
immediately found a bug that would have broken every install: `drizzle-orm`
imports `better-sqlite3` by name, which resolves inside the workspace but not
in a release installed with npm, so the packaged Core died on its first import.
Fixed by aliasing that name to the encrypted fork, which also means a release
now carries exactly one native SQLite module.

**Left, and only the first is code.**

1. **Point the site at the real API**, once DNS resolves:
   `NEXT_PUBLIC_SITE_API=https://api.woventechnology.com` and redeploy `site`.
   Next reads it at build time, so a variable change alone does nothing. It is
   deliberately still on the Railway address, which works today.
2. **Import the DNS.** `docs/dns/woventechnology.com.zone` into Cloudflare, every
   record DNS-only. See `docs/dns/README.md` for why the clouds stay grey.
3. **A release key.** `node packaging/keygen.mjs`, commit the public half, set
   `WOVEN_RELEASE_KEY`. The machinery around it is proven; the key is not made.
4. **Email.** A Resend key on the site API, or reservations and applications are
   stored and never acknowledged. `RESEND_API_KEY` is unset today.
5. **An external penetration test** of the Core, the relay and the tunnel before
   strangers point browsers at something holding their files.
6. **Public repository or hosted installer.** While the repository is private,
   `curl | bash` needs a signed-in `gh`. The Mac page leads with the source path
   for that reason.
7. **A language model on the box.** Ask is rules today and says so. `/status`
   lists every claim against what is built.
8. **Hardware.** Cameras, radios, the screen and the Outside processor are the
   box's. The camera room is designed and its Core routes exist; a Mac reports
   `capture: "absent"` from the hardware layer and the page says so.

## What has never been tried

Worth keeping separate from the list above, because these are unknowns rather
than tasks.

- **A second machine.** The rehearsal simulates a clean home on this Mac. It
  does not simulate a different Mac, a different macOS, or an Intel one.
- **A long soak.** The login service has never run for days. Nightly snapshots,
  log rotation and the relay reconnecting after a laptop sleeps are all
  untested over time.
- **A real library.** Restore drills pass on scratch data, not on a household's
  hundreds of gigabytes.

## How to run everything

```bash
pnpm -r typecheck && pnpm -r lint && pnpm -r test     # every package
cd apps/web && LIVE_CORE=1 pnpm exec playwright test   # the dashboard against a real Core (about 10 minutes)
```

Run the Playwright suite on an otherwise idle machine; under a parallel build the Core's Gate can miss its start-up deadline and the run reports that instead of testing anything.
