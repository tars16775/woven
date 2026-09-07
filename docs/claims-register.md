# Claims register

Every public claim on woven.example that needs evidence before it can stay on the site. Reviewed before each release. A claim whose status is not "Supported" by its review date is softened to a target or removed. Owners are TBD until the founding team is in place.

Status values: Target (labelled as an engineering target on the site), Draft (claim is live and needs evidence), Supported (evidence on file), Retired.

| # | Claim | Where it appears | Evidence needed | Owner | Review date | Status |
|---|-------|------------------|-----------------|-------|-------------|--------|
| 1 | The Inside has no route to the internet; the Gate is hardware isolation, not a setting | Home (#sides, TwoSides caption), /privacy (#gate), /core-plus specs "The Gate", press boilerplate | Carrier board schematic showing the Inside SoC has no path to the WAN PHY except via the Gate processor; independent network penetration test of a P1 unit | TBD (electrical + security) | 2027-01-15 (before pre-orders) | Draft |
| 2 | The Outside (router) runs on its own network processor that cannot see inside | Home (#router), product pages (#router), specs "Runs on" | Same schematic; firmware architecture note; test showing router compromise does not expose Inside storage or LAN | TBD (electrical + security) | 2027-01-15 | Draft |
| 3 | Voice, home control, cameras, files/photos/memory never cross the Gate; pinned in software, not settings | /privacy promises, PrivacyPanel, footer disclaimer, /legal privacy policy | Policy engine source with pinned categories; egress audit of a pilot unit over 30 days showing zero bytes from those pipelines | TBD (AI + security) | 2026-12-15 (pilot exit) | Draft |
| 4 | Every crossing is recorded with what was sent and who approved it | Home (#privacy), /privacy, /tandem routing, ScreenActivity, product (#govern) | Receipt schema and storage design; pilot receipts spot-checked against network captures | TBD (AI) | 2026-12-15 | Draft |
| 5 | No facial recognition in the first release | /home (Cameras feature) | Vision model inventory for v1; product decision record | TBD (AI) | 2027-06-01 (v1 freeze) | Draft |
| 6 | Lifetime OS updates | Specs "OS updates", InTheBox "invisibly" list, product (#box) | Written support policy with a definition of "lifetime" (hardware generation), funding assumption, end-of-support terms in /legal | TBD (founders + legal) | 2027-01-15 | Draft |
| 7 | Security support window published; final security release at end of support (site currently implies support to at least 2031 via the 8 to 10 year chassis life) | Home (#module), product (#module), /legal terms, /support status | Published security support period per hardware generation; PSIRT process; disclosure program contact live | TBD (security) | 2027-01-15 | Draft |
| 8 | Sub-second device actions (lights, locks, thermostats answer in under a second) | Home (#home), /home (Offline feature), product (#think "answers in under a second") | Bench measurements on 20 tested devices across 5 categories; p95 latency on LAN with WAN unplugged | TBD (embedded) | 2026-12-15 | Draft |
| 9 | Tandem answers in under a second from household context | Home (#tandem), /tandem hero, AskDemo "420 ms" | Measured p50/p95 for calendar and file lookups on Core, Core+ and Core Pro modules | TBD (AI) | 2026-12-15 | Draft |
| 10 | "99.6% inside" and "98% stayed inside" figures | AppPrivacy phone screen, ScreenActivity, PrivacyPanel model week | These are illustrative until pilot data exists; pilot-measured inside share over the six weeks, with methodology. Screens must be labelled as examples until then | TBD (AI) | 2026-12-15 | Draft |
| 11 | More than sixty percent of ordinary supported requests complete without a crossing | /tandem routing footnote | Same pilot measurement; definition of "ordinary supported request" | TBD (AI) | 2026-12-15 | Target |
| 12 | HDMI 2.1, 4K at 120 with HDR (Core+ and Core Pro); 4K at 60 (Core) | Home (#tv points), /home TV feature, specs "TV", compare table | Module SoC display engine spec; measured output on reference board with a 4K120 panel | TBD (embedded) | 2027-01-15 | Target |
| 13 | Wi-Fi 7 tri-band (Core+, Core Pro), dual-band (Core); 10 GbE WAN | Home (#router), product pages, specs, compare, tiers stats | Router module part selection; throughput test; regulatory certification plan | TBD (electrical) | 2027-01-15 | Target |
| 14 | Matter, Thread and Zigbee radios built in; Z-Wave by USB | Home (#home), /home Radios feature, product (#connect), specs | Radio module selection; Matter and Thread certification plan; Zigbee coordinator test | TBD (embedded) | 2027-01-15 | Target |
| 15 | Compute module swaps in sixty seconds, tool-less, with no re-pairing | Home (#module), product (#module), specs "Module swap", /support FAQ | Timed swap on EVT chassis; attestation flow test; state persistence test | TBD (mechanical + embedded) | 2027-06-01 | Target |
| 16 | Prices: Core $899, Core+ $1,499, Core Pro $2,499; upgrade modules from $600 | Home hero and tier sections, product pages, compare, /order, /press facts | BOM and margin model at 1,000 units; labelled as targets until pre-orders open | TBD (founders) | 2027-01-15 | Target |
| 17 | Delivery: pilot Q4 2026, pre-orders Q1 2027, v1 ships Q3 2027 | /founding-homes plan, Home (#founding), /press facts | Programme plan with supplier lead times; updated each quarter | TBD (founders) | quarterly, next 2026-12-01 | Target |
| 18 | Founding Homes get hardware at cost and a year of Gate crossings free | /founding-homes, Home (#founding), InTheBox "1 year of Gate crossings credit" | Pilot agreement text; cost model for crossings credit | TBD (founders + legal) | 2026-10-01 | Draft |
| 19 | Two-year warranty on chassis and module; 30-day returns | Specs "Warranty", /legal warranty, InTheBox "invisibly" list | Warranty terms reviewed by counsel; reserve funding | TBD (legal) | 2027-01-15 | Draft |
| 20 | Storage encrypted at rest; keys in the secure element never leave the box; storage unlocks only for an attested module | Specs "Encryption", /privacy security, /support FAQ, InTheBox | Encryption at rest is built (`apps/core/src/keystore.ts`, store, database, sealed private keys; Keychain on the Mac). Secure element part selection and attestation test remain for the box | TBD (security) | 2027-01-15 | Software built; hardware pending |
| 21 | No inbound ports; remote access is outbound only | Specs "Remote access", /privacy security | Relay design; port scan of a pilot unit from the WAN | TBD (security) | 2026-12-15 | Draft |
| 22 | Signed A/B updates with automatic rollback | Specs "Updates", /privacy security, /support status | Update pipeline design; forced-failure rollback test | TBD (embedded) | 2026-12-15 | Draft |
| 23 | Idle 8 to 22 W, AI load 60 to 140 W, under 25 or 28 dBA | Specs "Power, acoustics, size" | Measured on reference boards in the EVT chassis | TBD (electrical + mechanical) | 2027-06-01 | Target |
| 24 | Home Assistant runs inside; existing configurations and Zigbee networks migrate without re-pairing | Product (#connect), /home Radios, /support FAQ, /developers, Home (#why-not) | Migration test on three real configurations; Zigbee key export and import test | TBD (embedded) | 2026-12-15 | Draft |
| 25 | Agents run sandboxed as themselves with scoped, short-lived credentials and a receipt per action | Home (#agents), /tandem agents, /developers, Home (#why-not) | Runtime design; sandbox escape test; credential lifetime test | TBD (AI + security) | 2027-06-01 | Draft |
| 26 | Comparison facts: Home Assistant Green is $199 and has no assistant-class compute; a Mac mini runs agents as the user with full internet access; NAS AI is weak and camera apps phone home; cloud assistants need the internet for intent | Home (#why-not), compare link | Price check against vendor sites at each review; cite vendor documentation for the behavioural claims; re-verify quarterly | TBD (marketing) | quarterly, next 2026-12-01 | Draft |
| 27 | This site sets no cookies and runs no analytics | Footer, /legal "This website" | Automated check in CI: no Set-Cookie headers, no third-party scripts, no analytics packages in package.json; dashboard session lives in localStorage only | TBD (web) | each release | Supported (as of 2026-09-05; verify per release) |
| 28 | Telemetry is readable on the box, switchable off, and never contains content | /support FAQ, /legal privacy, /founding-homes asks | Telemetry schema; on-box viewer; consent flow | TBD (embedded + legal) | 2026-12-15 | Draft |
| 29 | Woven does not sell or share household data and runs no advertising business | /legal privacy | Privacy policy reviewed by counsel; board resolution | TBD (legal) | 2027-01-15 | Draft |
| 30 | Chassis lasts eight to ten years; compute module replaced every three to four years | Home (#module), product (#module), /press boilerplate | Component lifetime analysis; module roadmap commitment | TBD (mechanical + founders) | 2027-06-01 | Target |

## Where this lives now

The public half of this register is code: `apps/web/src/lib/claims.ts` holds every claim the site
makes with a status (`now`, `box`, `target`) and the note a visitor reads. The site's footnotes and
the `/status` page render from it, and `apps/web/tests/unit/claims.test.ts` fails the build if a page
cites a claim that does not exist, if a hardware feature is marked as shipping, or if a price or a
date is presented as settled. This table stays the internal review: owners, evidence and dates.

## Process

1. Before a release, the owner of each row confirms the status. Anything past its review date without evidence is changed on the site to a labelled target or removed in the same release.
2. New copy that makes a measurable statement gets a row here in the same change.
3. Figures that appear on rendered screens (phone, TV, front-screen components) are illustrative. Until row 10 is Supported, the surrounding copy must not present them as measurements.
4. The site footer and /legal already state that prices, specifications and performance figures are engineering targets. That disclaimer does not excuse a row from needing evidence.
