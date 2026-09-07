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
</content>
</invoke>
