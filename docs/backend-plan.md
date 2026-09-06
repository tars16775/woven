# Woven Backend: 50 Phases

Version 0.1, 2026-09-05. This is the plan for building everything the website promises, so the dashboard is real from day one. No code is written under this document until a phase is started.

## The one idea that makes it dynamic

The Mac is the first Woven Core. The same software runs on the box later. The only difference is a thin **hardware layer** that tells the core what it is running on: where storage lives, which radios exist, how to read temperature and memory, whether it is the router. On your Mac that layer says: storage is `/Volumes/Woven/Woven Data`, no radios yet, metrics from macOS, no router. On the box it says: chassis storage, Thread and Zigbee, the front screen, the Outside processor. Everything above that layer, the dashboard included, never changes. That is how "connect my Mac to Woven for now" becomes "the box arrives" without a rewrite.

Every number the dashboard shows comes from that layer, not from a constant. The model inside is whatever fits the machine; on a 16 GB Mac that is an 8B-class model, on Core+ it is 30B-class. The site already says "class", so this is honest.

## Architecture on your Mac

```
Inside  (your Mac, running as one user, no direct internet)
  apps/core        the Woven service: identity, policy, ledger, files, photos, home, Tandem
  engines          Ollama (models), Home Assistant (devices), go2rtc/Frigate (cameras)
  storage          /Volumes/Woven/Woven Data  (SQLite + content store on the LaCie volume)

The Gate (a second process on the Mac)
  the only path out: approved crossings, signed updates, your key from away
  every request logged to the ledger; can be closed

Outside (your existing router, for now)
  the Mac can read it, not be it. The Network page shows what is real and says so.

apps/web (the site)
  marketing on Railway; the dashboard the same code, talking to the core on the LAN
```

Stack, to be confirmed in phase 1: TypeScript on Node 22 for the core so it shares types and schemas with the site; Fastify for HTTP and WebSockets; SQLite with Drizzle for the database; a content-addressed file store on the volume; SimpleWebAuthn for passkeys; Zod schemas in a shared package; Docker via OrbStack for the engines that only ship as containers.

Honest limits of the Mac phase: no Thread or Zigbee without a Linux radio bridge; the Mac is not your router, so the Outside is observed rather than owned; camera detection runs on the CPU. All three are solved by the box.

## Progress

| Phase | State | Notes |
| --- | --- | --- |
| 1 Decisions and skeleton | done · 2026-09-05 | ADRs 0001 to 0005, workspace, schema, hardware layer, policy, core on :4000 |
| 2 Data layer | done · 2026-09-06 | SQLite WAL + Drizzle migrations, content store, snapshot and tested restore, nightly job |
| 3 Core service | done · 2026-09-06 | HTTPS with the household CA (ADR 0006), trust page on :4001, WebSocket `/v1/events`, `/v1/system/config`, `woven.local` over mDNS |
| 4 Ledger and events | done · 2026-09-06 | Landed inside phase 2: hash chain, tamper detection, receipt writer (`Ledger.append`), `/v1/ledger/*` |
| 5 Developer loop | done · 2026-09-06 | `pnpm seed` demo household, generic Linux hardware layer so CI can run the core, Playwright `LIVE_CORE=1` starts a real core for the e2e suite |
| 6 Site meets core | first pass · 2026-09-06 | dashboard discovers the core (woven.local, loopback :4002), "Connect to your Core" card, shell + Overview + Core + Activity read real status and ledger; remaining screens switch as their services land |
| 7 Household setup | next | |

## Tracks and phases

Each phase lists what gets built, when it is done, and what is needed from you. Phases inside a track are ordered; tracks can overlap after the Foundations.

### Track A · Foundations (phases 1 to 6)

**1. Decisions and skeleton.** Architecture decision records for language, database, storage layout, the hardware layer interface, and the Gate. Repo grows `apps/core`, `packages/schema`, `packages/policy`, `packages/hal`. Done when the ADRs are approved and `pnpm dev` starts an empty core on :4000. *From you: confirm the stack above, or say what you would rather use.*

**2. Data layer.** SQLite in WAL mode with migrations; the content store on the volume with hashing and dedup; a nightly snapshot to a second folder; a restore script that is tested, not assumed. Done when a snapshot restores to a fresh folder and the core boots from it. *From you: nothing.*

**3. Core service.** HTTP and WebSocket API with health, config, structured logs that never contain content, mDNS advertisement as `woven.local`, and local HTTPS with a household certificate authority that devices trust once by scanning a code. Passkeys require HTTPS, so this is not optional. Done when the site reaches `https://woven.local:4000/health` from your phone on the same Wi-Fi. *From you: the Mac on Ethernet or a fixed Wi-Fi, awake, with sleep disabled while plugged in.*

**4. Ledger and events.** The event envelope from the software PRD, an append-only receipts table with a hash chain, and a receipt writer every later phase uses. Done when a tampered row is detected on integrity check. *From you: nothing.*

**5. Developer loop.** The Start and Stop scripts run both services; seed data for a demo household; a CI job for the core; a test harness that runs the site's end-to-end suite against a real core instead of the browser mock. *From you: nothing.*

**6. Site meets core.** The dashboard discovers the core on the LAN, shows a "Connect to your Core" state when it is not reachable, and switches from the mock data layer to the typed API screen by screen behind a flag. The Railway site stays marketing-only. Done when Overview shows real uptime, memory and disk from your Mac. *From you: nothing.*

### Track B · Identity and household (phases 7 to 11)

**7. Household model.** Households, people, roles, and the data namespaces: household, personal, security, financial, health, work, children, guest. Done when two people can exist with separate private namespaces in the database.

**8. Passkeys.** Registration and sign-in with SimpleWebAuthn, sessions in httpOnly cookies bound to the device, recovery codes shown once. The login page's simulated path is removed. Done when you sign in on your phone with Face ID against your Mac. *From you: a phone and a laptop to enrol, and a decision on recovery: printed codes, or a second trusted person.*

**9. Code on the screen.** The core displays a rotating six-digit code on its "screen" (a window on the Mac now, the front panel later); entering it pairs a new device. Done when a fresh browser signs in by code alone on the LAN and is refused from outside it.

**10. Invitations and guests.** Invite by link with a role, accept with a passkey, guest access that expires and is scoped to specific devices. Done when Settings shows a real pending member who then joins.

**11. Data rights.** Export everything as a folder on the volume, delete a memory, delete an account, transfer ownership with strong authentication. Done when an exported folder is complete and a deleted account leaves no rows and no files. *From you: agreement on the retention window we publish.*

### Track C · Policy and the Gate (phases 12 to 17)

**12. Capabilities.** The registry of typed capabilities (`light.set_brightness`, `lock.unlock`, `commerce.order`…) with schemas, risk classes, readback and idempotency, and the prepare, execute and verify endpoints from the PRD.

**13. Policy engine.** Deterministic evaluation of risk classes A to H against person, role, namespace, presence, bounds and limits; approval tokens bound to exact parameters; idempotency keys on every side-effecting call. Done when the policy test suite passes with zero violations, including the "changed parameters after approval" case.

**14. Approvals for real.** Approval cards in the dashboard and on the screen, expiry, and receipts written for every decision. The Home page's unlock flow becomes real. Done when Activity shows a receipt with planned state, observed state and who approved.

**15. The Gate.** A separate process that is the core's only network egress. The core is started with no route except the Gate; the Gate enforces an allow list, logs every crossing with what was sent, and can be closed from the dashboard. Done when closing the Gate makes an approved crossing fail cleanly with a receipt. *From you: a decision on whether crossings use one frontier-model provider or several; the key goes in the Keychain, never the repo.*

**16. Signed updates.** Update manifests signed by a Woven key, verified on the Outside side of the Gate before anything is installed inside, with rollback. On the Mac this updates the core and site; on the box it becomes the A/B image path. *From you: you hold the signing key on a hardware token; I will tell you which one to buy.*

**17. Reaching home from away.** Outbound-only access with your key, no port forwarding. For the Mac phase, a WireGuard-based tunnel you control; the box replaces it with Woven's relay. Done when your phone on mobile data opens the dashboard and the Gate logs the session. *From you: a decision between running your own WireGuard endpoint or using Tailscale for the pilot.*

### Track D · Files, photos, media (phases 18 to 23)

**18. Backup protocol.** Chunked, content-addressed upload with dedup, per-person namespaces, quotas, resumable transfers. A folder-watch client for your Mac first; the phone and desktop apps come in the apps phase.

**19. Files dashboard for real.** Browse, upload, download, move, and household sharing with namespace rules, against the store. Done when the Files page shows your actual folders.

**20. Photo ingest.** Import from a folder or an iCloud export, EXIF, thumbnails and previews, a timeline. Done when the Photos page shows real photos. *From you: an export of a photo library to import, and permission to keep it on the volume.*

**21. Photo index.** Search by what is in them using an on-device embedding model, places from location data. Face clustering is designed but shipped off, as the site promises. Done when "lake" finds the lake trip.

**22. Media.** Library scan, playback in the dashboard and on the TV, transcoding on the Mac with ffmpeg where a device needs it.

**23. Integrity and restore.** Nightly integrity check of the store, snapshot to a second location, and a restore drill you can run from Settings. *From you: a second drive or a folder on the Mac for the snapshot copy.*

### Track E · Home (phases 24 to 29)

**24. Home engine.** Home Assistant in a container on the Mac via OrbStack, adapted through its WebSocket API into the capability graph. Wi-Fi, Ethernet and cloud-free LAN devices work immediately. *From you: install OrbStack when asked; it is the only virtualisation we need.*

**25. Radios.** Thread, Zigbee and Matter-over-Thread need a Linux host with the USB radio. Decision: a Home Assistant Green or a Raspberry Pi on the LAN as a radio bridge until the box, running the Thread border router and Matter server that the Mac's core talks to. *From you: a ZBT-1 radio stick and either a Home Assistant Green or a Pi 4, about $100 to $200 total.*

**26. Device graph.** Rooms, devices, states, live and stale indicators, and the offline test: unplug the internet and control the house. Done when the Home page controls your real lights with the WAN cable out.

**27. Routines.** Scenes, schedules, occupancy, and the "I'm leaving" journey with class checks and receipts.

**28. Locks and presence.** Class D actions gated on presence and approval; unlock from away requires the Gate plus approval on the screen. *From you: one smart lock or a lock simulator for testing.*

**29. Device lab.** Twenty tested devices across five categories, with results generated into the site's Supported devices table rather than typed by hand. *From you: a shopping list I will write, roughly four lights, three plugs, a thermostat, four sensors, one camera, one robot vacuum.*

### Track F · Cameras (phases 30 to 32)

**30. Camera ingest.** go2rtc and Frigate in containers, RTSP and ONVIF cameras, retention quotas on the volume. *From you: one RTSP camera to start.*

**31. Detection.** People, packages, cars and pets detected on the Mac's CPU and neural engine, written to the ledger and shown in the dashboard and on the TV. No faces.

**32. Camera controls.** Pause all cameras for real, a hardware-style privacy indicator on the screen, clip playback in the dashboard.

### Track G · Tandem (phases 33 to 38)

**33. Model runtime.** Ollama on the Mac with a model catalogue sized to the machine; the core reports the model inside dynamically. On 16 GB that is an 8B-class model at a quality-preserving quantisation. *From you: install Ollama when asked and accept about 6 GB of model downloads through the Gate.*

**34. Orchestrator.** Request router, context builder that respects namespaces, intent classifier, planner, and tool router over capabilities. The model suggests; the policy decides.

**35. Ask.** Streaming answers in the dashboard with provenance for every claim ("from the household calendar"). Voice follows in the apps phase.

**36. Memory.** Per-person memory with view, edit, delete and retention, and the rule that a passing remark does not become a durable memory.

**37. Crossings.** A frontier model through the Gate with an approval card that shows the exact package, minimal context, and a receipt of what left. *From you: the provider account; the key lives in the Keychain.*

**38. Evaluation.** Golden sets, adversarial prompt injection through email and web content, and a hard gate: zero permission violations before any release.

### Track H · Agents (phases 39 to 41)

**39. Agent runtime.** Sandboxed agents in containers with their own identities, short-lived scoped credentials, and no network except through capabilities.

**40. Catalogue.** Install, pause, revoke, and receipts, wired to the runtime; the three demo agents become real.

**41. LAN endpoint.** An OpenAI-compatible inference endpoint on the inside network with per-agent tokens, and the robot task API stub.

### Track I · TV, network, screen, core (phases 42 to 45)

**42. TV.** A kiosk route driven over HDMI from the Mac to your TV, controlled from the app: photos, cameras, media, Ask. Done when the living room TV shows Woven. *From you: an HDMI cable from the Mac to the TV.*

**43. Network, honestly.** On the Mac, the Outside is observed, not owned: the core reads your current router, discovers devices by mDNS and ARP, and the Network page says which parts are live and which arrive with the box. The Gate state is real.

**44. The screen.** The box's five-inch screen as a window on the Mac and a route for the physical panel later: Ready, activity, the pairing code, the privacy indicator.

**45. Core management.** Real metrics from the hardware layer, storage health, restart and shutdown, diagnostics bundles with privacy filters, update state.

### Track J · Hardening, pilot, hardware (phases 46 to 50)

**46. Security.** Threat model, secrets only in the Keychain or the secure store, dependency and secret scanning in CI, negative authorisation tests, a scoped external penetration test before the pilot. *From you: a budget decision on the pen test.*

**47. Observability.** Privacy-filtered metrics and logs, incident runbooks for the P0 classes in the PRD, alerts on the screen.

**48. The public side.** Reservations, Founding Homes applications and support contact move off browser storage onto the Railway-hosted site with its own small store and email delivery. This is the only data we hold outside a household, and it is marketing data, not household data. *From you: DNS for woventechnology.com when you are ready, and a transactional email provider account.*

**49. Packaging for the box.** A Linux image with systemd units, A/B partitions and secure boot hooks, running the same core with the box's hardware layer: chassis storage, radios, screen, the Outside processor. Done when the image boots on a Strix Halo mini PC and the dashboard cannot tell the difference. *From you: one off-the-shelf unified-memory box when we get here.*

**50. Founding Homes readiness.** Install path for fifty off-the-shelf boxes, onboarding in under two minutes, opt-in telemetry you can read, support tooling, and the data-room evidence: local share, device reliability, uptime, retention. *From you: the pilot households, and a weekly hour to review what the numbers say.*

## Everything needed from you, in one list

1. Confirm the stack, or change it: TypeScript core, SQLite, OrbStack for containers.
2. Keep the Mac awake and on the network; allow installing OrbStack and Ollama when asked.
3. Buy, when the phase arrives: a ZBT-1 radio stick and a Home Assistant Green or Raspberry Pi; one RTSP camera; a smart lock; the device-lab list; an HDMI cable; a hardware security key for signing; later one unified-memory mini PC.
4. Accounts: a frontier-model provider for crossings; a transactional email provider; DNS control for woventechnology.com. Keys go in the Keychain.
5. Decisions: recovery method for passkeys; retention window; WireGuard versus Tailscale for the pilot; one or several model providers; pen-test budget.
6. Data: a photo library export to import, and a second location for backups.
7. Time: enrol devices when asked, and weekly pilot reviews once Founding Homes starts.

## Order of work

Phases 1 to 6, then 7 to 8, then 12 to 15, then 6 again to switch the first screens to real data. That gives a dashboard that is genuinely live on your Mac: sign in with a passkey, see real machine state, take a real action, get a real receipt, with the Gate in front of everything. Everything after that fills in surfaces the site already shows.
