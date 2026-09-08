# The Woven dashboard, designed

This is the design brief and the running record of the work. The dashboard is
designed first and finished as a surface; the backend is then built to fit it.

## What we are designing

A private appliance in the house, reached from a browser. Not a SaaS console.
The person opening it owns the machine, and everything on the screen belongs to
them. That has consequences for the design:

- **No dashboards of dashboards.** Every screen is a room in the house, not a
  report about one. Files are files. Cameras are cameras.
- **Nothing is invented.** There is no sample household. A screen either shows
  what the Core holds or says plainly that it holds nothing yet.
- **The state of the machine is always one glance away**, and never shouty.
- **Every consequential act leaves a receipt**, and the receipt is readable.

## The rules

**Type.** Schibsted Grotesk for display (page titles, big numbers), Instrument
Sans for everything else, JetBrains Mono for machine facts (addresses, hashes,
byte counts, times). Three sizes of voice and no more.

**Colour.** Bone ground, graphite for surfaces that represent the machine
itself, one amber light. Green means it stayed inside. Amber means it asks
first or it crossed. Nothing else earns a colour. Every pair meets 4.5:1.

**Space.** A 4px grid. Cards sit on 20px padding, gaps are 16px, sections are
separated by 24px. Nothing is centred that could be aligned.

**Motion.** 200ms for state, 700ms for arrival, `cubic-bezier(0.16, 1, 0.3, 1)`.
Anything that moves can be turned off, and is, for anyone who asked.

**Density.** One comfortable default. A person reading their own house is not
scanning a spreadsheet.

## Phases

Design first, in order. Each phase lands as its own commit.

### Foundation

1. Design tokens for the dashboard: spacing, type scale, radii, elevation, motion.
2. Primitives: Card, Button, Pill, Stat, Meter, Field, Input, Select, Switch, Tabs, Badge, Avatar, Skeleton.
3. An icon set drawn in one hand: line, 1.5px, 20px box, no dependency.
4. The shell: sidebar with sections, status line, command bar, page header patterns.
5. Motion, focus and reduced-motion rules applied across the primitives.

### Arrival

6. First run: what a brand new household sees on the day the Core answers.
7. The tutorial system: dismissible guidance, per person, remembered on the Core.
8. Per-screen first-visit notes: what this room is and what it will hold.
9. Demo mode: an explicit, labelled, opt-in tour for showing the product. Never a signed-in household.

### Rooms

10. Overview
11. Ask
12. Files
13. Photos
14. Cameras
15. TV
16. Home
17. Network
18. Agents
19. Activity
20. Privacy
21. Core
22. Settings

### Across every room

23. Search and the command palette.
24. Approvals and notifications.
25. Empty states, one per room, each saying what will fill it.
26. Loading: skeletons that match the shape of what arrives.
27. Errors: what broke, what it means, what to do.
28. Mobile.
29. Accessibility: contrast, focus order, landmarks, announcements.
30. Design QA: screenshots of every room in both schemes, contrast audit, this document brought up to date.

## Record

| Phase | Landed | Note |
| --- | --- | --- |
| 1 | tokens | radii, elevation, surfaces, motion, layout constants |
| 2 | primitives | the full set; Switch is honest about latency, Empty is a room not an apology |
| 3 | icons | 28 shapes, one hand, no dependency |
| 4 | shell | five groups, account foot, no stale numbers |
| 5 | motion | three arrivals, one focus ring, nothing loops |
| 6-8 | arrival | welcome, walkthrough, room notes; guide state per person |
| 9 | demo | a real Core with `WOVEN_DEMO=on`, labelled on every screen |
| 10 | Overview | decisions before reports; unknown figures hold their space |
| 11 | Ask | a live log, starters the rules can answer |
| 12 | Files | five row buttons became one download and one menu |
| 13 | Photos | a lightbox that walks; one tile component |
| 14 | Cameras | designed in full before the hardware; schema and client are the spec |
| 15 | TV | the slideshow advances, stops and says where it is |
| 16 | Home | the switch waits for the device rather than claiming |
| 17-19 | Network, Agents, Activity | the Gate gets its weight; filters that match nothing say so |
| 20-22 | Privacy, Core, Settings | "nothing crossed" reads as a result; guidance can be replayed |
| 23 | search | one field: rooms first, then the index. ⌘K, arrows, Enter |
| 24 | approvals | amber ground, asked-at time, a chip visible from every room |
| 25-27 | empty, loading, broken | skeletons shaped like the content; an error that says your data is fine |
| 28-29 | mobile, access | two-up statistics, wrapping receipts, radiogroup not tablist |
| 30 | QA | both schemes captured, contrast re-checked, this document closed |

## What the backend now has to build

The design is finished ahead of the software in exactly one place, deliberately.

`packages/schema` defines `CamerasState`, `CameraView` and `CameraEvent`, and
`apps/web/src/lib/core/cameras.ts` is the client the Core will implement:

| Route | Does |
| --- | --- |
| `GET /v1/cameras` | everything the room reads, in one answer |
| `POST /v1/cameras/pause` | stop or resume every camera at once |
| `POST /v1/cameras/:id/detection` | detection on or off, without stopping the stream |
| `POST /v1/cameras/:id/retention` | days of clips this camera keeps |
| `GET /v1/cameras/:id/snapshot` | a still from the live stream |
| `GET /v1/cameras/events/:id/clip` | the clip for one event |

Until they exist, a 404 is read as `capture: "absent"` and the room renders
its honest state, so the dashboard is correct against today's Core and
correct against tomorrow's box without a second code path.
