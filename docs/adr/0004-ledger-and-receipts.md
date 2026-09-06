# ADR 0004: An append-only, hash-chained ledger

Status: accepted · 2026-09-05

## Decision

Every consequential thing the core does is an event in the `events` table: who, what capability, which target, planned and observed state, where it ran (inside, device, policy, gate), and what, if anything, left the house. Rows are never updated or deleted. Each row carries the SHA-256 of the previous row's hash and its own content, so the chain can be verified.

Receipts are the user-facing projection of events. They never contain secrets, tokens, raw prompts, voice or file contents.

## Why

The site promises "every consequential action has a receipt" and "where your data went today". A ledger that can be silently edited is worth nothing. A hash chain makes tampering detectable on the household's own machine, with no third party.

## Consequences

- Deleting a person's data is handled by tombstone events plus removal of referenced content, not by deleting ledger rows. The ledger records that a deletion happened, not what was deleted.
- The Gate writes to the same ledger. A crossing without a receipt is a bug that fails the build.
- Integrity is checked nightly and on demand from the Core page.
