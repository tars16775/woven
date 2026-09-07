/**
 * Every measurable claim the site makes, in one place, with what stands
 * behind it. The page copy links to a row here rather than asserting on its
 * own; the footnotes at the bottom of a page and the /status page are both
 * rendered from this file, so the site cannot say more than this list does.
 *
 * `docs/claims-register.md` is the review process around it. This is the part
 * a visitor sees.
 *
 *   now    True today of Woven Core running on a Mac. Anyone can check it.
 *   box    Real in the design, waiting on hardware that does not exist yet.
 *   target An engineering target with no measurement behind it yet.
 */
export type Availability = "now" | "box" | "target";

export type Claim = {
  /** What the site says, in one line. */
  claim: string;
  status: Availability;
  /** What stands behind it, in a visitor's words. Shown as the footnote. */
  note: string;
};

export const availabilityLabel: Record<Availability, string> = {
  now: "Available now",
  box: "With the box",
  target: "Engineering target",
};

export const availabilityBlurb: Record<Availability, string> = {
  now: "Running today on a Mac. You can install it and check every word.",
  box: "Designed and specified, waiting on hardware that has not been built yet.",
  target: "A number we are designing towards. Nothing has been measured.",
};

export const claims = {
  /* What the software does today ------------------------------------------ */
  gate: {
    claim: "Nothing leaves without a crossing you approved, and every crossing is recorded",
    status: "now",
    note: "Built and tested. The Core has no network egress of its own: a separate Gate process is the only way out, it holds an allow list, it can be closed, and each crossing writes a receipt naming the host, what was sent and who approved it. On the box the Gate is also a hardware boundary; on a Mac it is a process boundary.",
  },
  receipts: {
    claim: "Every consequential action leaves a receipt in a ledger that cannot be edited quietly",
    status: "now",
    note: "Built and tested. Receipts form a hash chain; changing or removing one breaks the chain, and the box checks it nightly and on demand.",
  },
  encryption: {
    claim: "Everything on the drive is encrypted at rest",
    status: "now",
    note: "Built and tested. The database, every stored file and the box's private keys are encrypted under a household key. On a Mac that key lives in the login Keychain; on the box it will live in a secure element. A copied drive is unreadable without it.",
  },
  passkeys: {
    claim: "Passkeys, per-person spaces and roles",
    status: "now",
    note: "Built and tested. Personal, health, financial and work spaces are one person's, the owner included. Recovery codes and a trusted-adult rescue code are the way back in.",
  },
  remote: {
    claim: "Reach your house from anywhere with no open ports",
    status: "now",
    note: "Built and tested. The box holds one outbound connection to a relay; a browser you paired at home encrypts every request end to end. The relay carries ciphertext and keeps nothing. The relay service is not deployed yet, so this needs one you run.",
  },
  killSwitch: {
    claim: "One switch stops everything",
    status: "now",
    note: "Built and tested. Off closes the Gate, drops the relay, stops every scheduled job and refuses every request but the switch itself. It survives a restart.",
  },
  backups: {
    claim: "Nightly snapshots, a second copy, and a restore you can rehearse",
    status: "now",
    note: "Built and tested. The restore drill rebuilds the newest snapshot in a scratch folder, verifies the chain and the files, and reports, without touching what is live.",
  },
  search: {
    claim: "Search your files, memory and routines on the box",
    status: "now",
    note: "Built and tested. Names, paths, memories and routines are indexed on the box. Reading inside documents needs the model, which is not here yet.",
  },
  photoSearch: {
    claim: "Search photos by what is in them, on the box",
    status: "now",
    note: "Built and tested. A vision model runs on the box; it arrives as a download you approve at the Gate, pinned by hash. No faces are recognised.",
  },

  /* What is honestly not here yet ----------------------------------------- */
  tandem: {
    claim: "Tandem answers from the household's own files, calendar and home",
    status: "box",
    note: "Not built. Today the assistant is a rule engine over what the box already holds, and it says so on every screen: it can find a file by name, count your photos, switch a light and read the receipts. There is no language model on the box and no calendar yet. The 20B to 70B class models on the specification sheet need the box's memory.",
  },
  voice: {
    claim: "Speech and the wake word are processed on the box",
    status: "box",
    note: "Not built. There is no microphone path, no wake word and no speech model in the software today.",
  },
  radios: {
    claim: "Matter, Thread and Zigbee radios, with devices answering in under a second",
    status: "box",
    note: "Not built. Home control runs today against a simulated set of devices so the permissions, approvals and receipts can be exercised honestly. No radio has been fitted and no real device has been switched.",
  },
  cameras: {
    claim: "Cameras with detection on the box and clips that never leave",
    status: "box",
    note: "Not built. There is no camera capture in the software. The dashboard says so when it is connected to a real Core.",
  },
  router: {
    claim: "The router runs on its own processor that cannot see inside",
    status: "box",
    note: "Not built. The Network page reads what the Mac can see of the network it is on. There is no router and no second processor.",
  },
  tv: {
    claim: "Your television, over one HDMI cable",
    status: "box",
    note: "Partly built. Photos, video and music play from the box in a browser today. The HDMI output, the living-room interface and the remote arrive with the box.",
  },
  agents: {
    claim: "Agents run sandboxed, as themselves, with scoped credentials",
    status: "box",
    note: "Not built. There is no agent runtime. The permission engine, the receipts and the Gate that agents would run inside are built and tested; the sandbox is not. The dashboard's Agents page says so when it is connected.",
  },
  homeAssistant: {
    claim: "Home Assistant runs inside Woven, with your configuration and Zigbee network intact",
    status: "box",
    note: "Not built. No integration exists yet, and no migration has been attempted.",
  },
  secureElement: {
    claim: "Keys live in a secure element and storage unlocks only for an attested module",
    status: "box",
    note: "Not built. Encryption at rest is real and running; the secure element, the attestation and the module that would hold them are hardware that does not exist yet.",
  },
  moduleSwap: {
    claim: "The compute module swaps in about a minute, with nothing to re-pair",
    status: "box",
    note: "Not built. No chassis or module has been manufactured, so nothing has been swapped or timed.",
  },

  /* Numbers we are designing towards -------------------------------------- */
  price: {
    claim: "Core $899, Core+ $1,499, Core Pro $2,499",
    status: "target",
    note: "A target, not a price. No bill of materials has been costed at volume and nothing is for sale. A reservation takes no money and is not an order.",
  },
  delivery: {
    claim: "Pilot in late 2026, pre-orders in early 2027, shipping in the second half of 2027",
    status: "target",
    note: "A plan, not a commitment. No supplier has been engaged and no tooling has been ordered. Treat every date as the earliest it could happen if everything goes well.",
  },
  speed: {
    claim: "Answers in under a second",
    status: "target",
    note: "Not measured. There is no model on the box to measure. The figures on the rendered screens throughout this site are illustrations, not measurements.",
  },
  insideShare: {
    claim: "Almost everything stays inside",
    status: "target",
    note: "Not measured. The share of work that stays inside will be measured during the pilot and published. Any percentage shown on a screen here is drawn, not counted. Your own box counts the real figure and shows it on the Privacy page.",
  },
  wifi: {
    claim: "Wi-Fi 7 and 10 GbE",
    status: "target",
    note: "A target. The radio and network parts have not been selected, certified or measured.",
  },
  power: {
    claim: "8 to 22 W idle, under 25 dBA",
    status: "target",
    note: "A target from the reference design. Nothing has been measured in a chassis, because there is no chassis.",
  },
  support: {
    claim: "Updates for the life of the box, security support to at least 2031",
    status: "target",
    note: "An intention, not yet a written policy. Signed updates with automatic rollback are built and tested in the software today.",
  },
  warranty: {
    claim: "Two-year warranty, 30-day returns",
    status: "target",
    note: "Drafted, not reviewed by counsel, and not in force. There is nothing to return.",
  },
  noCookies: {
    claim: "This site sets no cookies and runs no analytics",
    status: "now",
    note: "True and checkable. There are no analytics packages in this site's dependencies and no third-party scripts. Your sign-in lives in this browser's own storage.",
  },
} as const satisfies Record<string, Claim>;

export type ClaimId = keyof typeof claims;

export const claimIds = Object.keys(claims) as ClaimId[];

export function claimsByStatus(status: Availability): { id: ClaimId; claim: Claim }[] {
  return claimIds.filter((id) => claims[id].status === status).map((id) => ({ id, claim: claims[id] as Claim }));
}
