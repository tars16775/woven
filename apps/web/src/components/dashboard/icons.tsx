import type { SVGProps } from "react";

/**
 * The dashboard's icons (phase 3).
 *
 * Drawn in one hand: a 20-unit box, 1.5 stroke, round caps and joins, no
 * fills, currentColor throughout. They are geometry, not illustration — a
 * camera is a rectangle and a circle, a house is a roof and a wall. Anything
 * that needed shading would be a picture, and a picture belongs in the
 * content, not the furniture.
 *
 * No icon library: this is nineteen shapes, and a dependency for them would
 * cost more to load than the whole set weighs.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------- rooms */

/** Overview: the house seen whole, four panes. */
export const IconOverview = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.75" y="2.75" width="6" height="6" rx="1.5" />
    <rect x="11.25" y="2.75" width="6" height="6" rx="1.5" />
    <rect x="2.75" y="11.25" width="6" height="6" rx="1.5" />
    <rect x="11.25" y="11.25" width="6" height="6" rx="1.5" />
  </Icon>
);

/** Ask: a question put to the house, and an answer coming back. */
export const IconAsk = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17 10.5a6 6 0 0 1-6 6H7l-3.2 2.1a.4.4 0 0 1-.6-.35V10.5a6 6 0 0 1 6-6h1.8a6 6 0 0 1 6 6Z" />
    <circle cx="10" cy="10.5" r="1.4" />
  </Icon>
);

/** Files: a folder with a fold, not a stack of paper. */
export const IconFiles = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.75 5.5A1.75 1.75 0 0 1 4.5 3.75h2.6c.5 0 .97.21 1.3.58l.9 1.02c.33.37.8.58 1.3.58h5A1.75 1.75 0 0 1 17.25 7.7v6.55A1.75 1.75 0 0 1 15.5 16h-11a1.75 1.75 0 0 1-1.75-1.75Z" />
  </Icon>
);

/** Photos: a frame with a horizon and a sun. */
export const IconPhotos = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2" />
    <circle cx="7.25" cy="8" r="1.4" />
    <path d="M2.75 13.4 6.6 10.2a1.4 1.4 0 0 1 1.85.05l3.2 3.05a1.4 1.4 0 0 0 1.86.04l1.55-1.35a1.4 1.4 0 0 1 1.84 0l.35.3" />
  </Icon>
);

/** Home: a roof and a wall. */
export const IconHome = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.6 10 3l7 5.6" />
    <path d="M4.6 9.9v5.4c0 .6.5 1.1 1.1 1.1h8.6c.6 0 1.1-.5 1.1-1.1V9.9" />
    <path d="M8.1 16.4v-3.7c0-.6.5-1.1 1.1-1.1h1.6c.6 0 1.1.5 1.1 1.1v3.7" />
  </Icon>
);

/** Cameras: a body and a lens. */
export const IconCameras = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.75 7.4c0-.9.73-1.65 1.63-1.65h6.24c.9 0 1.63.74 1.63 1.65v5.2c0 .91-.73 1.65-1.63 1.65H4.38c-.9 0-1.63-.74-1.63-1.65Z" />
    <path d="m12.25 9.4 3.7-2.2c.5-.3 1.05.06 1.05.63v4.34c0 .57-.55.93-1.05.63l-3.7-2.2Z" />
  </Icon>
);

/** TV: a screen on a stand. */
export const IconTv = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.75" y="4" width="14.5" height="9.5" rx="1.75" />
    <path d="M7.25 16.25h5.5" />
    <path d="M10 13.5v2.75" />
  </Icon>
);

/** Network: two networks and the gate between them. */
export const IconNetwork = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="10" r="2.25" />
    <circle cx="15" cy="10" r="2.25" />
    <path d="M7.25 10h5.5" />
    <path d="M10 6.75v6.5" />
  </Icon>
);

/** Agents: a task with a hand on it. */
export const IconAgents = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.75" y="4.75" width="12.5" height="11.5" rx="2" />
    <path d="M7 3.5v2.5M13 3.5v2.5" />
    <path d="M6.9 11.2 8.8 13l4.3-4.3" />
  </Icon>
);

/** Activity: a ledger line, rising. */
export const IconActivity = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.75 12.4h2.7L7.6 6.6l2.9 8.4 2-4.7h4.75" />
  </Icon>
);

/** Privacy: a shield, closed. */
export const IconPrivacy = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 2.9 4.6 5v4.9c0 3.2 2.2 6.1 5.4 7.2 3.2-1.1 5.4-4 5.4-7.2V5Z" />
  </Icon>
);

/** Core: the box itself, with its light. */
export const IconCore = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.25" y="4.25" width="13.5" height="11.5" rx="2.25" />
    <path d="M6.4 8.1h4.6M6.4 11.1h3" />
    <circle cx="14" cy="11.4" r="1.15" fill="currentColor" stroke="none" />
  </Icon>
);

/** Settings: a dial with a notch. */
export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="2.4" />
    <path d="M10 2.9v1.7M10 15.4v1.7M17.1 10h-1.7M4.6 10H2.9M15.02 4.98l-1.2 1.2M6.18 13.82l-1.2 1.2M15.02 15.02l-1.2-1.2M6.18 6.18l-1.2-1.2" />
  </Icon>
);

/* ----------------------------------------------------------------- actions */

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="9" r="5.25" />
    <path d="m12.9 12.9 4 4" />
  </Icon>
);

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 4.25v11.5M4.25 10h11.5" />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4.5 10.4 3.4 3.3 7.6-7.4" />
  </Icon>
);

export const IconX = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5.4 5.4 9.2 9.2M14.6 5.4l-9.2 9.2" />
  </Icon>
);

export const IconChevron = ({ dir = "right", ...p }: IconProps & { dir?: "up" | "down" | "left" | "right" }) => {
  const rot = dir === "up" ? -90 : dir === "down" ? 90 : dir === "left" ? 180 : 0;
  return (
    <Icon {...p} style={{ transform: `rotate(${rot}deg)`, ...(p.style ?? {}) }}>
      <path d="m8 4.75 5 5.25-5 5.25" />
    </Icon>
  );
};

export const IconUpload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 13.25V3.75" />
    <path d="m6.4 7.1 3.6-3.35 3.6 3.35" />
    <path d="M3.75 12.5v2.25c0 .83.67 1.5 1.5 1.5h9.5c.83 0 1.5-.67 1.5-1.5V12.5" />
  </Icon>
);

export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 3.75v9.5" />
    <path d="m6.4 9.9 3.6 3.35 3.6-3.35" />
    <path d="M3.75 12.5v2.25c0 .83.67 1.5 1.5 1.5h9.5c.83 0 1.5-.67 1.5-1.5V12.5" />
  </Icon>
);

export const IconPlay = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.75 4.9 15 10l-8.25 5.1Z" />
  </Icon>
);

export const IconPause = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7.4 4.75v10.5M12.6 4.75v10.5" />
  </Icon>
);

export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.25" y="8.75" width="11.5" height="7.5" rx="1.75" />
    <path d="M6.9 8.75V6.9a3.1 3.1 0 0 1 6.2 0v1.85" />
  </Icon>
);

export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.9 5.6h12.2" />
    <path d="M7.6 5.6V4.4c0-.6.5-1.1 1.1-1.1h2.6c.6 0 1.1.5 1.1 1.1v1.2" />
    <path d="M5.5 5.6 6.1 16c.04.63.56 1.12 1.2 1.12h5.4c.64 0 1.16-.5 1.2-1.12l.6-10.4" />
  </Icon>
);

export const IconMore = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="4.6" cy="10" r=".9" fill="currentColor" stroke="none" />
    <circle cx="10" cy="10" r=".9" fill="currentColor" stroke="none" />
    <circle cx="15.4" cy="10" r=".9" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 10a6 6 0 1 1-1.9-4.38" />
    <path d="M16.25 3.9v3.1h-3.1" />
  </Icon>
);

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 6.4v4.2" />
    <circle cx="10" cy="13.4" r=".9" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 9.4v4.2" />
    <circle cx="10" cy="6.6" r=".9" fill="currentColor" stroke="none" />
  </Icon>
);

/** The Gate: a doorway with a threshold nothing crosses unasked. */
export const IconGate = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.25 16.25V6.4c0-.5.33-.94.81-1.08l3.5-1a1.5 1.5 0 0 1 .88 0l3.5 1c.48.14.81.58.81 1.08v9.85" />
    <path d="M3.5 16.25h13" />
    <path d="M12.1 10.6h.01" />
  </Icon>
);

/* ------------------------------------------------------------------ mapping */

/** Every room in the sidebar, keyed by its route. */
export const roomIcon = {
  "/dashboard": IconOverview,
  "/dashboard/ask": IconAsk,
  "/dashboard/files": IconFiles,
  "/dashboard/photos": IconPhotos,
  "/dashboard/home": IconHome,
  "/dashboard/cameras": IconCameras,
  "/dashboard/tv": IconTv,
  "/dashboard/network": IconNetwork,
  "/dashboard/agents": IconAgents,
  "/dashboard/activity": IconActivity,
  "/dashboard/privacy": IconPrivacy,
  "/dashboard/core": IconCore,
  "/dashboard/settings": IconSettings,
} as const;

export type RoomHref = keyof typeof roomIcon;
