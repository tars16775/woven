"use client";

import { useGuide, type GuideId } from "@/lib/dashboard/guide";
import { IconInfo, IconX } from "./icons";

/**
 * What a room is, said once (phase 8).
 *
 * The first time a person opens a room they get one short paragraph saying
 * what it holds and what makes it different from the equivalent screen on a
 * service they already use. Then it is gone, for them, on this device, and
 * the room is just the room.
 *
 * It is a note rather than a card: a card would look like content, and this
 * is furniture that is about to leave.
 */

type RoomKey = Extract<GuideId, `room:${string}`>;

const notes: Record<RoomKey, { title: string; body: string }> = {
  "room:overview": {
    title: "This is the whole house at a glance",
    body: "Everything here is computed from your Core when the page asks. Nothing is cached from a server, averaged across households, or estimated. If a number is not known yet, it says so rather than guessing.",
  },
  "room:ask": {
    title: "Questions are answered inside",
    body: "Ask reads the box's own data and answers from it. When a question needs something from outside, it says so and offers one crossing at the Gate, with the exact text that would be sent shown before you agree.",
  },
  "room:files": {
    title: "Stored once, encrypted, and yours",
    body: "Files are written to your drive under a key that lives in this house. Identical files are stored a single time. Nothing is uploaded to anyone else's computer, so there is no plan, no quota and nobody to ask.",
  },
  "room:photos": {
    title: "Indexed on the box, not in a cloud",
    body: "Dates, cameras and places are read from the files themselves and kept here. Face grouping is off by design. Search runs on your Core, which is why it works with the Gate closed.",
  },
  "room:tv": {
    title: "Your own library, on the big screen",
    body: "Videos and music from your drive, played here or full screen on whatever this browser is plugged into. Formats a browser cannot play are converted by the box as they stream.",
  },
  "room:home": {
    title: "Devices act, and then report back",
    body: "A light or a plug is immediate. A lock asks first. Either way the box reads the device's own state afterwards and writes what actually happened, not what it intended.",
  },
  "room:cameras": {
    title: "Detection stays in the house",
    body: "When cameras are paired, clips are written to your drive and detection runs on the box's own processor. Nothing is streamed to a service, and there is no subscription to keep footage.",
  },
  "room:network": {
    title: "Two networks, and a Gate between them",
    body: "The Inside has no route to the internet. The Gate is the only way anything crosses, it asks each time, and it records what was sent. Closing it stops everything, including updates.",
  },
  "room:activity": {
    title: "A record you can check, not a log you must trust",
    body: "Every consequential act is chained to the one before it. Verifying walks the whole chain and recomputes each hash, so a changed or missing line is visible rather than deniable.",
  },
  "room:privacy": {
    title: "The numbers here come from the receipts",
    body: "Nothing on this page is a policy statement. What stayed inside, what crossed, and what each crossing sent are counted from the ledger, and you can open any of them.",
  },
  "room:agents": {
    title: "Nothing runs on its own identity yet",
    body: "Routines act with the permissions of whoever wrote them, and Ask answers from the box's data. An agent runtime with its own identity and credentials is not built, and this page will not pretend otherwise.",
  },
  "room:core": {
    title: "The machine, and the switch",
    body: "What this Core is, what it is running, and how to verify the ledger. The power control here stops the software answering anything except itself, so you can always turn it back on.",
  },
  "room:settings": {
    title: "Settings that live on your Core",
    body: "People, passkeys, backups and remote access are stored on the box. Appearance and language are stored in this browser, because they describe this screen rather than the house.",
  },
};

export function RoomNote({ id }: { id: RoomKey }) {
  const { show, dismiss } = useGuide(id);
  if (!show) return null;
  const note = notes[id];

  return (
    <div className="mb-6 flex items-start gap-3 rounded-[12px] bg-white px-4 py-3.5 shadow-[var(--shadow-card)] ring-1 ring-ink/5" role="note">
      <IconInfo size={18} className="mt-[1px] shrink-0 text-ash" />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium">{note.title}</div>
        <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-ash">{note.body}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Got it, do not show this again"
        className="tap -mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-ash hover:bg-bone hover:text-ink"
      >
        <IconX size={15} />
      </button>
    </div>
  );
}
