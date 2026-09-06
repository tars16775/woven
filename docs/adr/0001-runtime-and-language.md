# ADR 0001: One language across the box and the site

Status: accepted · 2026-09-05

## Decision

The Woven Core service, the Gate, the shared packages and the website are all TypeScript on Node 22, in one pnpm workspace. Strict compiler settings everywhere: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`.

## Why

- The dashboard is the product surface. Sharing schemas and types between the site and the core removes the largest class of integration bugs and lets one change flow through both sides in one commit.
- Node 22 runs on the Mac today and on the Linux box later without a toolchain change.
- The engines that need other runtimes (Home Assistant, Ollama, camera pipelines) are run as separate processes behind typed adapters, not linked in.

## Consequences

- CPU-heavy work (photo indexing, video) is delegated to engines or worker processes, never done in the request path.
- Every boundary is validated with Zod schemas from `@woven/schema`; unvalidated input never reaches business logic.
- If a component ever needs a systems language (the Gate's packet filter on the box, for example), it is a separate process with a typed contract, and this ADR is amended.
