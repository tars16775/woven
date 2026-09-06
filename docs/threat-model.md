# Threat model

Status: living document · started 2026-09-06 · phase 46

## What we protect

The household's data on the box (files, photos, receipts, memory, device pairings), the household's control over its home (locks, alarms, purchases), and the household's privacy (nothing leaves without a receipt that says what left).

## Who we protect it from

| Adversary | Reach | What they want |
| --- | --- | --- |
| Someone on the home Wi-Fi (a guest, a compromised laptop, a smart-TV app) | LAN | read files, unlock doors, exfiltrate |
| Someone on the internet | WAN | reach the core at all; intercept updates or crossings |
| A member of the household overstepping (a child, a guest, an ex-partner) | signed-in | read another person's private space, act above their role |
| A model or an agent that has been prompt-injected | inside the core | take an action the household did not ask for; leak context |
| Someone with the drive (theft, disposal) | physical | read the data at rest |
| Us, or a supply-chain compromise of a dependency | code | anything |

## Boundaries and the controls on them

- **The LAN.** The core listens only on the home network and loopback. Every route that reads or changes household data needs a device session (httpOnly cookie, hashed at rest, revocable, bound to a person; guests expire). WebAuthn passkeys are the credential; the relying party is only an origin the core was told to trust. The screen code is served on loopback only and locks after five misses per minute. Negative tests: `test/identity.test.ts`, `test/actions.test.ts`, `test/files.test.ts` (a child cannot open the owner's lease; a stranger's passkey does nothing).
- **The internet.** The core has no egress; lint forbids `fetch` and HTTP clients outside `src/gate/client.ts`. The Gate is a separate process on loopback with a secret minted at start, an allow list (checked on every redirect hop), an open/closed switch, and its own crossing log. Every crossing is a class C action that asks first; the receipt records exactly what was sent. Remote access (phase 17) will be outbound-only through the Gate; the core never listens on a public port.
- **Between people.** Namespaces: personal, health, financial and work are one person's even from the owner; role grants come from `packages/policy`; the files service applies them on every read. Ownership changes and factory reset are class H: a fresh passkey assertion from the owner.
- **Between the model and the world.** The policy engine, not the model, decides. Approvals are bound to a hash of the exact parameters; a changed action never runs (`test/actions.test.ts`). Agents get their own identities and scoped credentials (track H).
- **At rest.** Everything on the data volume is encrypted under the household data key (`src/keystore.ts`): the database (SQLite with ChaCha20, via `better-sqlite3-multiple-ciphers`), every object in the store (AES-256-CTR with a per-object IV, `src/store/index.ts`) and the CA and server private keys (AES-256-GCM, `src/tls.ts`). On a Mac the key lives in the login Keychain; on the box it will live in the secure element. Per-purpose keys are derived from it, so a snapshot (which stays encrypted, and carries the sealed keys) is unreadable without the key. Diagnostics bundles and exports pass through the scrub filter (`src/diagnostics.ts`).
- **The code.** Dependencies are pinned by the lockfile; CI runs `pnpm audit` at high severity and a secret scanner on every push; migrations must be checked in (CI fails on drift). A scoped external penetration test is planned before the pilot.

## Known gaps, in order

1. Update signing (phase 16) is not built; until then updates are `git pull`.
2. Remote access (phase 17) is not built; there is no way in from outside, which is safe but inconvenient.
3. Rate limiting on sign-in routes other than the screen code; add before the pilot.
4. Sessions are not bound to a device key; a stolen cookie works until revoked (30-day life, "sign out other devices" exists).
5. The simulated home adapter has no real devices behind it; the class D path is exercised only against it until track E.
