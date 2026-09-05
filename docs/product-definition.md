# Woven: Product Definition

Version 0.1, 2026-09-04. This document unifies the planning docs (software PRD, hardware PRD, integrated MVP plan, business plan), the investor deck, and the agent-gateway research into one definition. It is the source of truth for scope. The planning docs remain the long-range architecture reference.

## One sentence

Woven Core is one box for the whole house: it stores everything a household owns, runs its smart home and its television, is the household's Wi-Fi router, thinks locally with a private assistant called Tandem, lets the cloud in only through an approved Gate, and is the one place every AI agent, assistant and robot in the home is allowed to run and act through.

Internally this is an offline home data center. It is never marketed with those words.

## Inside, Outside, and the Gate

The chassis holds two computers.

- **Inside.** The compute module, the household storage, the radios, the cameras, Tandem, the TV output. It has no route to the internet. This is wiring, not a setting.
- **Outside.** A separate network processor with its own memory that is the household's router: Wi-Fi 7, the internet port, a guest network, per-device rules and schedules. It cannot read the Inside.
- **The Gate.** The only path between them. It forwards cloud bursts the household approves one at a time, verifies signed updates before they cross, and carries a household member's key when they reach home from away. It records every crossing and stores no content.

Marketing leads with this architecture rather than with "local AI" or "privacy", because it is the thing competitors cannot claim.

## Also included, free

- **TV.** HDMI 2.1 to the television. Photos, movies, cameras and Tandem on the biggest screen in the house, served from the box. No subscription, account or ads.
- **Router.** The Outside replaces the household's router; one box replaces router, hub and NAS.

## Why this, why now

- Households are about to run AI agents with root-level access to family life. OpenClaw 2.0 shipped family sessions in August 2026; it also shipped a critical RCE, a malware-ridden skill marketplace, and ~180k internet-exposed instances. Nobody sells the safe, appliance-grade version.
- Cloud assistants are moving the wrong way. Gemini for Home cannot process intent without the cloud. Amazon removed local voice processing from Echo.
- Local hardware is now commodity. Dozens of near-identical unified-memory mini PCs exist. UGREEN shipped the hardware and reviewers called its AI a bust. The missing product is the software and the household layer.
- Robots arrive this year with remote human operators looking through their cameras. Homes will want a local box that records, gates and limits that.
- DRAM stays expensive until at least late 2027. Custom hardware margins are thin now. Software leads; steel follows demand.

## The four layers of the box

| Layer | What it does | Built from |
|---|---|---|
| **Store** | Personal cloud for every device: files, backup, photos with on-box indexing, media server, camera archives that never leave the house. | Open-source components (Nextcloud/Immich/Jellyfin/Frigate class) behind Woven's identity and permission layer. |
| **Connect** | Smart-home brain. Matter, Thread, Zigbee radios; local voice; routines; occupancy. Exposes every device as a normalized capability (the Device Graph, part of Woven Fabric). | Home Assistant class engine wrapped by the Woven gateway. |
| **Think** | Local inference for voice, intent, retrieval, summaries and everyday requests. Tandem is the household assistant. Cloud burst for heavy jobs, always approved, always logged. Distributes inference across other home machines where available. | Ollama-class runtime, PAIR-aware scheduler, Tandem orchestrator, model router. |
| **Govern** | The agent gateway. Every actor (Tandem, third-party agents, cloud assistants, robots, household members, guests) gets an identity, scoped credentials, a permission policy, and leaves a receipt. Agents run in a sandbox and can only act through registered capabilities. | Woven's own code: identity and household model, policy engine, capability gateway, activity ledger, agent sandbox. |

Govern is the layer Woven owns outright and the one nothing else on the market has. Store, Connect and Think are table stakes assembled from proven components; Woven's work there is integration, onboarding and the household model.

## Surfaces

- **The app** (iOS, Android, any browser on the LAN, secure remote access through the Gate): Home, Ask, Files, Photos, Privacy. Signing in is by passkey or the six-digit code on the box's screen; there are no passwords. Smart-home control lives under Home. Privacy holds per-category rules and the log of every cloud burst and every agent action.
- **The screen** (5-inch touch panel on the box): setup without a phone, a single "Ready." state with model/memory/storage/temperature, and "Where your data went today." Tap actions: pause cloud, pause cameras, back up now, guest Wi-Fi.
- **Tandem**: text and voice, across files, photos, calendar, home and agents. Answers locally by default; asks before bursting.

## Non-negotiable principles

1. **The model is not a security boundary.** A prompt, plan or tool suggestion never substitutes for deterministic authentication, authorization, schema validation and execution verification.
2. **Local first, cloud by permission.** Voice, home control, cameras, files, photos and memory never leave the box by default. Cloud bursts are approved, minimal, and logged with what was sent and why.
3. **Every consequential action has a receipt.** Who asked, which agent acted, what capability, what data, local or cloud, verified result. Receipts are user-readable and never contain secrets.
4. **Namespaces are real.** Household shared, personal private, security, financial, children, guest. No agent or member crosses one without policy.
5. **Risk classes gate actions.** A read state, B lights/media, C bounded thermostat/routines, D locks and alarms, E purchases, F money, G dangerous robot actions, H admin. F and G are unsupported in v1. D, E and H require explicit approval.
6. **The chassis outlives the compute.** Household data, device pairings, permissions and automations live on chassis storage. A compute module swap needs zero re-pairing.
7. **The appliance keeps working when the subscription stops.** Subscription pays for cloud overflow and advanced services, not hostage value.
8. **Never claim "everything stays local."** Say local-first and cloud when permitted. Every public claim has an owner and evidence.

## Hardware (targets, not commitments)

Three tiers on one chassis with a removable compute module. Core (32 GB), Core+ (64 GB, the volume SKU), Core Pro (128 GB). Full spec, BOM, build and qualification plans live in the hardware PRD. Hardware ships only after Woven OS has proven itself on off-the-shelf boxes and a paid pre-order gate is met.

## Build order

Woven OS runs on commodity hardware first: Strix Halo mini PCs, Mac mini, Framework Desktop, and as an app on existing home-server platforms. Each milestone is usable on its own and each depends on the one before it.

| Milestone | Deliverable | Proves |
|---|---|---|
| **M0 Spine** | Household identity, policy engine, capability gateway, activity ledger, web app shell with Privacy/Activity. Runs on one Linux box. | The govern layer exists and every later component plugs into it. |
| **M1 Store** | Files and photos through the gateway; device backup; the Files and Photos tabs; "Ready." screen. | A household would plug this in for storage alone. |
| **M2 Connect** | Smart-home engine integrated as capabilities; Home tab; routines; risk classes A-D enforced; offline operation with WAN unplugged. | Local home control with receipts. |
| **M3 Think** | Local model runtime, Tandem, model router, cloud burst with approval card and log; Ask tab; voice. | Private assistant that asks before it bursts. |
| **M4 Agents** | Agent sandbox hosting OpenClaw-compatible agents with scoped credentials; agent receipts on the screen and in Privacy; LAN endpoint for robots and devices. | The box is the safe home for agents. |
| **M5 Pilot** | 50 homes on off-the-shelf boxes; signed updates; telemetry the user can read and switch off. | Retention, local share, cloud-burst attach, purchase intent. |

## What is explicitly out of v1

Money movement, custody or brokerage. Marketplace, travel or insurance fulfillment. Biometric identification. Child-directed features. Robot motor or safety control. Custom silicon or production tooling before the pre-order gate. International launch.

## Open questions

- Trademark clearance for "Woven" and "Tandem" has not been done.
- Several deck citations need verification before investor use.
- Choice of smart-home engine integration depth (embed Home Assistant vs. build on its APIs) is an M2 decision.
- Cloud burst provider strategy: multi-provider from day one, abstracted behind the model router.
