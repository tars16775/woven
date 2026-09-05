import { PhoneFrame, TabBar } from "./frame";

/* Shared bits ------------------------------------------------------------ */

function Card({ children, className = "", dark = false }: { children: React.ReactNode; className?: string; dark?: boolean }) {
  return (
    <div className={`rounded-[16px] ${dark ? "bg-graphite text-bone" : "bg-white ring-1 ring-ink/5"} ${className}`}>{children}</div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="text-[11px] text-ash">{k}</div>
      <div className="mt-0.5 font-display text-[20px] font-medium leading-none tracking-[-0.02em]">{v}</div>
      <div className="mt-1 text-[11px] text-ash">{sub}</div>
    </Card>
  );
}

const tones = ["#d9d6cd", "#c9c7c0", "#e7e4dc", "#bdbab2", "#e0ddd5", "#cfccc3", "#f0eee8", "#c4c1b8", "#dbd8cf"];

/* Screens ---------------------------------------------------------------- */

export function AppHome({ width }: { width?: number }) {
  return (
    <PhoneFrame
      width={width}
      label="The Woven app home screen: Good evening, Alex. All inside, 0 bytes crossed the Gate today. Files 1.2 TB, Photos 48,210, Home 24 devices, TV in the living room, and two suggestions from Tandem."
    >
      <div className="relative h-full">
        <div className="font-display text-[24px] font-medium tracking-[-0.02em]">Good evening, Alex</div>
        <div className="text-[11px] text-ash">Everything is running at home · Woven Core+</div>

        <Card dark className="mt-4 flex items-center gap-3 px-4 py-3.5">
          <span className="orb" style={{ ["--orb" as string]: "10px" }} />
          <div className="flex-1">
            <div className="text-[14px] font-medium">All inside</div>
            <div className="text-[11px] text-ash-2">0 bytes crossed the Gate today</div>
          </div>
          <div className="text-right text-[11px] text-ash-2">
            <div>38/64 GB</div>
            <div>1.2/2 TB</div>
          </div>
        </Card>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Stat k="Files" v="1.2 TB" sub="3 devices syncing" />
          <Stat k="Photos" v="48,210" sub="312 new · indexed" />
          <Stat k="Home" v="24 devices" sub="Goodnight 22:30" />
          <Stat k="TV" v="Living room" sub="Photos · Lake trip" />
        </div>

        <div className="mt-4 text-[12px] font-semibold">Tandem suggests</div>
        {[
          ["Your lease renews in 12 days.", "I found the PDF and last year's rent. Want a summary?"],
          ["Maya's laptop hasn't backed up in 6 days.", "Remind her, or back up over Wi-Fi tonight?"],
        ].map(([t, d]) => (
          <Card key={t} className="mt-2 flex gap-2.5 px-3.5 py-3">
            <span className="mt-[5px] block h-[7px] w-[7px] shrink-0 rounded-full bg-amber" />
            <div>
              <div className="text-[12px] font-medium">{t}</div>
              <div className="text-[11px] text-ash">{d}</div>
            </div>
          </Card>
        ))}

        <div className="mt-3 flex items-center gap-2.5 rounded-full bg-white px-3.5 py-2.5 ring-1 ring-ink/8">
          <span className="orb" style={{ ["--orb" as string]: "8px" }} />
          <span className="flex-1 text-[12px] text-ash">Ask Tandem anything…</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] text-bone">↑</span>
        </div>

        <TabBar active="Home" />
      </div>
    </PhoneFrame>
  );
}

export function AppAsk({ width }: { width?: number }) {
  return (
    <PhoneFrame
      width={width} dark
      label="The Ask screen: Tandem answers a question about Maya's dentist appointment from the household calendar, inside, in 420 ms, then asks before a deep research task crosses the Gate."
    >
      <div className="relative h-full">
        <div className="flex items-center justify-between">
          <div className="font-display text-[22px] font-medium tracking-[-0.02em]">Ask</div>
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ash-2">
            <span className="orb" style={{ ["--orb" as string]: "6px" }} /> inside
          </span>
        </div>
        <div className="mt-5 space-y-3">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-[14px] rounded-br-[4px] bg-bone px-3.5 py-2 text-[12.5px] text-ink">
              When is Maya&apos;s dentist appointment?
            </div>
          </div>
          <div>
            <div className="max-w-[86%] rounded-[14px] rounded-bl-[4px] bg-white/8 px-3.5 py-2 text-[12.5px] leading-snug">
              Thursday at 4:10 pm, from the household calendar. Sam is picking her up.
            </div>
            <div className="mt-1 pl-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ash-2">inside · 420 ms · calendar</div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-[14px] rounded-br-[4px] bg-bone px-3.5 py-2 text-[12.5px] text-ink">
              Compare heat pumps for this house.
            </div>
          </div>
          <div className="rounded-[14px] border border-amber/50 bg-amber/10 p-3.5">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-2">Cross the Gate? · asks first</div>
            <div className="mt-1 text-[12.5px] font-medium">Deep research: compare heat pumps</div>
            <div className="mt-0.5 text-[11px] text-ash-2">Sends the task and house size. No names, files or history.</div>
            <div className="mt-2.5 flex gap-2">
              <span className="flex-1 rounded-[6px] bg-amber px-3 py-1.5 text-center text-[11px] font-medium text-ink">Approve once</span>
              <span className="flex-1 rounded-[6px] bg-bone/90 px-3 py-1.5 text-center text-[11px] font-medium text-ink">Keep inside</span>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-[86px] flex items-center gap-2.5 rounded-full bg-white/8 px-3.5 py-2.5">
          <span className="orb" style={{ ["--orb" as string]: "8px" }} />
          <span className="flex-1 text-[12px] text-ash-2">Ask Tandem anything…</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-bone text-[11px] text-ink">↑</span>
        </div>
        <TabBar active="Ask" dark />
      </div>
    </PhoneFrame>
  );
}

export function AppPhotos({ width }: { width?: number }) {
  return (
    <PhoneFrame
      width={width}
      label="The Photos screen: 48,210 photos indexed inside, filters for Lake trip, Maya, Garden and Tampa, a grid of thumbnails, and the Lake trip album playing on the living room TV."
    >
      <div className="relative h-full">
        <div className="font-display text-[24px] font-medium tracking-[-0.02em]">Photos</div>
        <div className="text-[11px] text-ash">48,210 · indexed inside · 14 people · 62 places</div>
        <div className="mt-3 flex gap-2">
          {["Lake trip", "Maya", "Garden", "Tampa"].map((c, i) => (
            <span key={c} className={`rounded-full px-3 py-1 text-[11px] font-medium ${i === 0 ? "bg-ink text-bone" : "bg-white ring-1 ring-ink/8"}`}>
              {c}
            </span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-[3px] overflow-hidden rounded-[12px]">
          {Array.from({ length: 21 }).map((_, i) => (
            <div key={i} className="aspect-square" style={{ background: tones[(i * 5) % tones.length] }} />
          ))}
        </div>
        <Card className="mt-3 flex items-center justify-between px-3.5 py-3">
          <div>
            <div className="text-[12px] font-medium">On the TV now</div>
            <div className="text-[11px] text-ash">Lake trip · 38 photos · living room</div>
          </div>
          <span className="rounded-[6px] bg-bone px-2.5 py-1 text-[11px] font-medium">Stop</span>
        </Card>
        <TabBar active="Photos" />
      </div>
    </PhoneFrame>
  );
}

export function AppPrivacy({ width }: { width?: number }) {
  const rows: [string, string, "inside" | "ask"][] = [
    ["Voice & conversations", "Inside", "inside"],
    ["Home control", "Inside", "inside"],
    ["Cameras & clips", "Inside", "inside"],
    ["Files, photos, memory", "Inside", "inside"],
    ["Deep research", "Ask me", "ask"],
    ["Video generation", "Ask me", "ask"],
  ];
  return (
    <PhoneFrame
      width={width}
      label="The Privacy screen: 99.6% inside this week with 3 crossings, all approved. Voice, home control, cameras and files are pinned to Inside; deep research and video generation ask first. A Close the Gate switch."
    >
      <div className="relative h-full">
        <div className="font-display text-[24px] font-medium tracking-[-0.02em]">Privacy</div>
        <Card dark className="mt-3 px-4 py-4">
          <div className="text-[11px] text-ash-2">This week</div>
          <div className="mt-0.5 font-display text-[30px] font-medium leading-none tracking-[-0.02em]">99.6% inside</div>
          <div className="mt-1 text-[11px] text-ash-2">3 crossings · all approved by you</div>
          <div className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[99.6%] rounded-full bg-amber" />
          </div>
        </Card>
        <div className="mt-3 space-y-1.5">
          {rows.map(([k, v, tone]) => (
            <div key={k} className="flex items-center justify-between rounded-[10px] bg-white px-3.5 py-2.5 ring-1 ring-ink/5">
              <span className="text-[12px] font-medium">{k}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone === "inside" ? "bg-local-bg text-local" : "bg-ask-bg text-ask"}`}>{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-[10px] bg-graphite px-3.5 py-3 text-bone">
          <span className="text-[12px] font-medium">Close the Gate</span>
          <span className="relative block h-5 w-9 rounded-full bg-white/20">
            <span className="absolute left-[2px] top-[2px] block h-4 w-4 rounded-full bg-white" />
          </span>
        </div>
        <TabBar active="Privacy" />
      </div>
    </PhoneFrame>
  );
}

export function AppRooms({ width }: { width?: number }) {
  const rooms: [string, string, boolean][] = [
    ["Living room", "2 lights on · 21 °C", true],
    ["Kitchen", "All off · motion clear", false],
    ["Entry", "Locked · porch 30%", false],
    ["Bedroom", "Bedside 15% · fan on", true],
  ];
  return (
    <PhoneFrame
      width={width}
      label="The Home screen: works offline. Goodnight, Leaving and Movie routines, four rooms with lights and temperatures, and the living room TV showing the Lake trip photos."
    >
      <div className="relative h-full">
        <div className="flex items-center justify-between">
          <div className="font-display text-[24px] font-medium tracking-[-0.02em]">Home</div>
          <span className="rounded-full bg-local-bg px-2.5 py-1 text-[11px] font-medium text-local">Works offline</span>
        </div>
        <div className="mt-3 flex gap-2">
          {["Goodnight", "Leaving", "Movie"].map((r) => (
            <span key={r} className="rounded-[8px] bg-white px-3 py-1.5 text-[11px] font-medium ring-1 ring-ink/8">{r}</span>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {rooms.map(([r, d, occ]) => (
            <Card key={r} className="flex items-center justify-between px-3.5 py-3">
              <div>
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  <span className={`block h-[6px] w-[6px] rounded-full ${occ ? "bg-amber" : "bg-ink/20"}`} />
                  {r}
                </div>
                <div className="mt-0.5 text-[11px] text-ash">{d}</div>
              </div>
              <span className="text-[11px] text-ash">{occ ? "Occupied" : "Empty"}</span>
            </Card>
          ))}
        </div>
        <Card dark className="mt-3 px-3.5 py-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium">Living room TV</span>
            <span className="text-ash-2">Photos · Lake trip</span>
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            {["◂", "▸", "Ask", "Off"].map((k) => (
              <span key={k} className="rounded-[6px] bg-white/8 py-1.5 text-center text-[11px]">{k}</span>
            ))}
          </div>
        </Card>
        <TabBar active="Home" />
      </div>
    </PhoneFrame>
  );
}
