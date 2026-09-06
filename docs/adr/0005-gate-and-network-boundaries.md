# ADR 0005: The Gate is the only way out, and the public site is a separate world

Status: accepted · 2026-09-05

## Decision

1. The core process has no network egress of its own. Its only HTTP client is the Gate client, which talks to the Gate process on the same machine. The Gate holds the allow list, performs approved crossings, verifies update signatures, and writes every crossing to the ledger. Closing the Gate makes any crossing fail with a receipt.
2. On the Mac, this is enforced by construction (no other outbound client in the codebase, verified by a lint rule and a test) and by the Gate running as a separate process with its own credentials. On the box it is also enforced by wiring: the Inside has no route to the internet except the Gate.
3. Remote access from away is outbound-only from the Gate to a relay the household controls; the core never listens on a public port.
4. The public marketing site, reservations and Founding Homes applications are Outside concerns hosted on Railway with their own small store. They hold marketing data and never household data. Nothing on the Inside depends on them.

## Why

Privacy that depends on a setting can be turned off. Privacy that depends on structure cannot. The Inside/Outside/Gate story is what the site sells; this ADR is where it becomes code.

## Consequences

- A dependency that opens network connections on its own (telemetry, update checks, analytics) is not allowed in the core. `pnpm audit` and a custom lint rule guard this.
- Engines that need the internet (model downloads, Home Assistant integrations for cloud devices) request it through the Gate and appear in the crossings log.
