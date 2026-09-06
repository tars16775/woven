# ADR 0003: A hardware layer so the Mac and the box run the same code

Status: accepted · 2026-09-05

## Decision

All knowledge of the machine lives in `@woven/hal`. It exposes one interface:

- `identity()`: what this is (kind, model, memory, storage, a stable id).
- `paths`: where the data root, keys and store live.
- `metrics()`: CPU, memory, disk, temperature where available, uptime.
- `features`: which radios exist, whether there is a front screen, whether this machine is also the router.

Implementations: `macos` (today), `linux-box` (the Woven chassis), `linux-generic` (off-the-shelf mini PCs for the pilot). The core selects one at start and never asks the operating system anything directly.

## Why

The dashboard must be truthful on every machine without special cases in the UI. On a 16 GB Mac the model inside is 8B-class and there are no radios; the pages already say "class" and show radios as present or absent. Reading those facts from the hardware layer is what makes "connect my Mac for now" and "the box arrives later" the same product.

## Consequences

- No constant in the core or the site may describe the hardware. Numbers come from `hal`.
- Where a fact is unavailable (the Mac cannot report its temperature without root), `hal` returns `null` and the UI shows "not reported", never a made-up value.
- The Gate on the Mac is a process; on the box it is also a separate processor. `features.router` tells the Network page which one it is looking at.
