# ADR 0006: Local HTTPS with a household certificate authority

Status: accepted · 2026-09-06

## Decision

1. The core serves HTTPS on the home network using a certificate it signs itself with a household certificate authority (CA) that it creates on first start. Both live in the keys directory of the data root; the CA key never leaves the box.
2. The server certificate covers `woven.local` (configurable), `localhost`, the machine's own `.local` name, `127.0.0.1` and the current LAN addresses. It is reissued automatically when it is within 30 days of expiry or when the addresses change. The CA lasts ten years.
3. Devices trust the CA once, through a plain-HTTP trust page on a second port that shows a QR code, the CA download and its fingerprint. That page is the only plain-HTTP surface and carries nothing about the household.
4. The core advertises itself over mDNS as `_woven._tcp` and answers for the `woven.local` name, so the household name works without changing the machine's own hostname.
5. No public CA, no ACME, no outside clock or revocation service is consulted. The core has no network egress (ADR 0005), and certificates are no exception.

## Why

Passkeys and the browser features the dashboard needs (WebAuthn, secure cookies, service workers) require a secure context. A public certificate would need a public domain that points at a private address, a renewal that crosses the Gate every two months, and an outside party who knows the household exists. A household CA needs one tap per device and nothing from outside.

## Consequences

- The first visit from a new device is `http://woven.local:4001`, not the dashboard. The site's "Connect to your Core" flow (phase 6) points there.
- Losing the keys directory means every device must trust a new CA. The keys directory is part of the snapshot layout for that reason.
- Tests and CI run with `WOVEN_TLS=off`; the certificate code has its own tests that establish a real TLS connection against the generated chain.
