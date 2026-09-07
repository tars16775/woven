"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Core3D } from "@/components/core-3d";
import { useSession } from "@/lib/auth";
import { formatPrice, tierOrder, tiers, type TierId } from "@/lib/site";
import {
  addons,
  cloudPlans,
  deposit,
  estimatedDelivery,
  finishes,
  storageOptions,
  type FinishId,
} from "@/lib/order";
import { siteApi } from "@/lib/site-api";
import { addReservation, type Reservation } from "@/lib/orders";

function isTier(v: string | null): v is TierId {
  return v === "core" || v === "core-plus" || v === "core-pro";
}

/**
 * Design-studio layout: the product stays put on the left while the
 * choices scroll on the right. Every choice changes the box in view.
 */
/** Whether the reservation reached anyone, or only this browser. */
type Delivery = "sending" | "received" | "emailed" | "local";

export function Configurator() {
  const params = useSearchParams();
  const session = useSession();
  // The model lives in the URL so a link to /order?tier=core-pro opens on
  // that box and Back/Forward move between models. An unknown ?tier= falls
  // back to the box most homes buy.
  const rawTier = params.get("tier");
  const tier: TierId = isTier(rawTier) ? rawTier : "core-plus";

  const [finish, setFinish] = useState<FinishId>("bone");
  const [storage, setStorage] = useState(storageOptions[tier][0].id);
  const [cloud, setCloud] = useState(cloudPlans[1].id);
  const [picked, setPicked] = useState<string[]>([]);
  const [reserved, setReserved] = useState<Reservation | null>(null);
  const [delivery, setDelivery] = useState<Delivery>("sending");

  // Changing the model resets storage to the included option and writes the
  // URL. Native replaceState is picked up by the Next router, so
  // useSearchParams updates without a server round trip.
  const selectTier = (id: TierId) => {
    if (id === tier) return;
    setStorage(storageOptions[id][0].id);
    window.history.replaceState(null, "", `/order?tier=${id}`);
  };

  const t = tiers[tier];
  const storageOpt = storageOptions[tier].find((s) => s.id === storage) ?? storageOptions[tier][0];
  const cloudOpt = cloudPlans.find((c) => c.id === cloud) ?? cloudPlans[0];
  const finishOpt = finishes.find((f) => f.id === finish) ?? finishes[0];

  const total = useMemo(
    () =>
      t.priceFrom +
      storageOpt.price +
      picked.reduce((sum, id) => sum + (addons.find((a) => a.id === id)?.price ?? 0), 0),
    [t, storageOpt, picked],
  );

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const reserve = () => {
    const r = addReservation({
      tier,
      finish: finishOpt.id,
      storage: storageOpt.id,
      cloud: cloudOpt.id,
      addons: picked,
      total,
      name: session?.name,
      email: session?.email,
    });
    setReserved(r);
    setDelivery("sending");
    // The reservation lives in this browser either way. Whether it also reached
    // anyone is a fact the confirmation reports rather than assumes.
    void siteApi
      .reservation({ code: r.code, tier: r.tier, finish: r.finish, storage: r.storage, cloud: r.cloud, addons: r.addons, total: r.total, deposit: r.deposit, ...(r.name ? { name: r.name } : {}), ...(r.email ? { email: r.email } : {}) })
      .then((res) => setDelivery(res.sent ? (res.mail === "sent" ? "emailed" : "received") : "local"))
      .catch(() => setDelivery("local"));
  };

  return (
    <div data-theme="light" className="bg-bone text-ink">
      <div className="mx-auto grid min-h-svh max-w-[1400px] lg:grid-cols-[1.15fr_1fr]">
        {/* Product view */}
        <div className="relative flex items-center justify-center px-6 pb-10 pt-24 lg:sticky lg:top-0 lg:h-svh lg:pt-14">
          <Core3D
            label={t.screenLabel}
            finish={finish}
            status={`${storageOpt.label} · ${t.memoryGb} GB · ${
              cloudOpt.id === "none" ? "Gate closed" : "Gate ready"
            }`}
            className="h-[52svh] w-full max-w-[720px] lg:h-[64svh]"
          />
          <p className="absolute bottom-6 left-0 right-0 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ash">
            {t.name} · {finishOpt.label}
          </p>
        </div>

        {/* Choices */}
        <div className="px-6 pb-32 pt-8 lg:px-12 lg:pb-24 lg:pt-28">
          <div className="mx-auto max-w-[440px]">
            <h1 className="font-display text-[34px] font-medium leading-none tracking-[-0.02em]">
              {t.name}
            </h1>
            <p className="mt-2 text-[14px] text-ash">
              Estimated delivery {estimatedDelivery[tier]} · Target price {formatPrice(t.priceFrom)}
            </p>
            <p className="mt-1 text-[13px] text-ash">
              No card required today. The deposit is taken when reservations open; we will tell you first.
            </p>

            {/* Tier */}
            <Group title="Model" kind="radio">
              {tierOrder.map((id) => {
                const x = tiers[id];
                return (
                  <Option
                    key={id}
                    selected={tier === id}
                    onSelect={() => selectTier(id)}
                    label={x.name.replace("Woven ", "")}
                    detail={`${x.memoryGb} GB · ${x.storageTb} TB · ${x.modelClass} class`}
                    meta={`Estimated delivery ${estimatedDelivery[id]}`}
                    price={formatPrice(x.priceFrom)}
                  />
                );
              })}
            </Group>

            {/* Finish */}
            <Group title="Finish" kind="radio">
              <div className="flex gap-3">
                {finishes.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={finish === f.id}
                    tabIndex={finish === f.id ? 0 : -1}
                    onClick={() => setFinish(f.id)}
                    className={`flex flex-1 items-center gap-3 rounded-[10px] border px-4 py-3 text-left text-[14px] transition-colors ${
                      finish === f.id
                        ? "border-ink bg-white"
                        : "border-ink/10 bg-white/60 hover:border-ink/30"
                    }`}
                  >
                    <span
                      className="block h-6 w-6 rounded-full ring-1 ring-ink/10"
                      style={{ background: f.swatch }}
                    />
                    <span className="font-medium">{f.label}</span>
                  </button>
                ))}
              </div>
            </Group>

            {/* Storage */}
            <Group title="Storage" kind="radio">
              {storageOptions[tier].map((s) => (
                <Option
                  key={s.id}
                  selected={storage === s.id}
                  onSelect={() => setStorage(s.id)}
                  label={s.label}
                  detail={s.price === 0 ? "Included" : "Two tool-less bays, up to 16 TB"}
                  price={s.price === 0 ? "Included" : `+${formatPrice(s.price)}`}
                />
              ))}
            </Group>

            {/* Cloud */}
            <Group
              title="Cloud"
              kind="radio"
              note="The box never needs a cloud account. Crossings are for heavy jobs, each one approved on the screen."
            >
              {cloudPlans.map((c) => (
                <Option
                  key={c.id}
                  selected={cloud === c.id}
                  onSelect={() => setCloud(c.id)}
                  label={c.label}
                  detail={c.detail}
                  price={c.monthly === 0 ? "Free" : `${formatPrice(c.monthly)}/mo`}
                />
              ))}
            </Group>

            {/* Add-ons */}
            <Group title="Add-ons" kind="checkbox">
              {addons.map((a) => (
                <Option
                  key={a.id}
                  selected={picked.includes(a.id)}
                  onSelect={() => toggle(a.id)}
                  label={a.label}
                  detail={a.detail}
                  price={`+${formatPrice(a.price)}`}
                  checkbox
                />
              ))}
            </Group>

            {/* What it replaces */}
            <div className="mt-10 rounded-[14px] bg-graphite p-5 text-bone">
              <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ash-2">What it replaces</div>
              <ul className="mt-3 space-y-1.5 text-[14px]">
                {[
                  ["Cloud storage for three people", "$120–360 / yr"],
                  ["A photo library subscription", "$36–120 / yr"],
                  ["A camera cloud plan", "$60–240 / yr"],
                  ["One AI assistant subscription", "$120 / yr"],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-baseline justify-between gap-4">
                    <span className="text-bone/85">{k}</span>
                    <span className="font-mono text-[12px] text-ash-2">{v}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-white/10 pt-3 text-[13px] text-ash-2">
                Typical households spend $336–840 a year on these. The box is a one-time purchase, and the local assistant is never a subscription.
              </div>
            </div>

            {/* Summary or confirmation */}
            {reserved ? (
              <Confirmation r={reserved} delivery={delivery} onAnother={() => setReserved(null)} />
            ) : (
              <div className="mt-12 rounded-[14px] bg-white p-6 ring-1 ring-ink/5">
                <dl className="space-y-2 text-[14px]">
                  <Row label={t.name} value={formatPrice(t.priceFrom)} />
                  {storageOpt.price > 0 && (
                    <Row label={`${storageOpt.label} storage`} value={`+${formatPrice(storageOpt.price)}`} />
                  )}
                  {picked.map((id) => {
                    const a = addons.find((x) => x.id === id)!;
                    return <Row key={id} label={a.label} value={`+${formatPrice(a.price)}`} />;
                  })}
                  {cloudOpt.monthly > 0 && (
                    <Row label="Gate crossings, after first year" value={`${formatPrice(cloudOpt.monthly)}/mo`} muted />
                  )}
                </dl>
                <dl className="hairline mt-3 space-y-2 border-t pt-3 text-[14px]">
                  <Row label="Target total" value={formatPrice(total)} strong />
                  <Row label="Due today" value="$0" />
                  <Row label="Refundable deposit, when reservations open" value={formatPrice(deposit)} muted />
                </dl>

                {session && (
                  <p className="mt-5 text-[13px] text-ash">
                    Reserving as <span className="font-medium text-ink">{session.name}</span>
                    {session.email ? <span> · {session.email}</span> : null}
                  </p>
                )}
                <button type="button" onClick={reserve} className="btn btn-primary mt-4 w-full">
                  Reserve your place
                </button>
                <p className="mt-4 text-[11px] leading-relaxed text-ash">
                  No card required today. The deposit is taken when reservations open; we will tell you first.
                  Prices are targets for the reference design and can change before shipment. Your reservation
                  is saved on this device; nothing is sent anywhere yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** What the person keeps after reserving: a code, what they chose, and what happens next. */
function Confirmation({ r, delivery, onAnother }: { r: Reservation; delivery: Delivery; onAnother: () => void }) {
  const t = tiers[r.tier];
  const storageOpt = storageOptions[r.tier].find((s) => s.id === r.storage);
  const cloudOpt = cloudPlans.find((c) => c.id === r.cloud);
  const finishOpt = finishes.find((f) => f.id === r.finish);
  const chosen = r.addons.map((id) => addons.find((a) => a.id === id)).filter(Boolean);
  return (
    <section aria-labelledby="reserved-heading" className="mt-12 rounded-[14px] bg-white p-6 ring-1 ring-ink/5">
      <div className={`flex items-center gap-2 text-[13px] font-medium ${delivery === "local" ? "text-ash" : "text-local"}`}>
        <span className={`block h-[6px] w-[6px] rounded-full ${delivery === "local" ? "bg-ash" : "bg-local"}`} aria-hidden />
        {delivery === "sending" ? "Saving…" : delivery === "local" ? "Saved on this device" : "We have it"}
      </div>
      <h2 id="reserved-heading" className="mt-3 font-display text-[26px] font-medium leading-none tracking-[-0.02em]">
        Your place is held.
      </h2>
      <p className="mt-2 text-[13px] text-ash">Your reservation code</p>
      <p className="mt-1 font-mono text-[24px] tracking-[0.04em]">{r.code}</p>
      {(r.name || r.email) && (
        <p className="mt-2 text-[13px] text-ash">
          Held for <span className="font-medium text-ink">{r.name ?? r.email}</span>
          {r.name && r.email ? <span> · {r.email}</span> : null}
        </p>
      )}

      <dl className="hairline mt-5 space-y-2 border-t pt-4 text-[14px]">
        <Row label={t.name} value={formatPrice(t.priceFrom)} />
        <Row label="Finish" value={finishOpt?.label ?? r.finish} muted />
        <Row
          label={`${storageOpt?.label ?? r.storage} storage`}
          value={storageOpt && storageOpt.price > 0 ? `+${formatPrice(storageOpt.price)}` : "Included"}
        />
        {chosen.map((a) => a && <Row key={a.id} label={a.label} value={`+${formatPrice(a.price)}`} />)}
        <Row
          label={cloudOpt?.label ?? "Cloud"}
          value={cloudOpt && cloudOpt.monthly > 0 ? `${formatPrice(cloudOpt.monthly)}/mo after first year` : "Free"}
          muted
        />
      </dl>
      <dl className="hairline mt-3 space-y-2 border-t pt-3 text-[14px]">
        <Row label="Target total" value={formatPrice(r.total)} strong />
        <Row label="Estimated delivery" value={estimatedDelivery[r.tier]} />
        <Row label="Refundable deposit, when reservations open" value={formatPrice(r.deposit)} muted />
      </dl>

      <div className="mt-5 rounded-[10px] bg-bone p-4 text-[13px]">
        <div className="font-medium">What happens next</div>
        {delivery === "local" ? (
          <>
            <ol className="mt-2 space-y-1.5 text-ash">
              <li>1. Nothing was sent. There is no ordering service running yet, so this reservation exists only in this browser.</li>
              <li>2. Keep the code. When reservations open, it is how you claim this configuration and its target price.</li>
              <li>3. Nothing is owed, and no card was asked for.</li>
            </ol>
            <p className="mt-3 text-ash">
              If you would rather be on a list a person reads,{" "}
              <Link href="/founding-homes" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
                apply to be a Founding Home
              </Link>
              .
            </p>
          </>
        ) : (
          <ol className="mt-2 space-y-1.5 text-ash">
            <li>1. We have your place and the configuration above.{delivery === "emailed" ? " A copy is in your inbox." : ""}</li>
            <li>2. Before shipping in {estimatedDelivery[r.tier]} we confirm the final price with you.</li>
            <li>3. You pay only when you confirm. Cancel any time for a full refund of the deposit.</li>
          </ol>
        )}
      </div>

      <Link href={`/order/status?code=${encodeURIComponent(r.code)}`} className="btn btn-primary mt-5 w-full">
        View your reservations
      </Link>
      <button
        type="button"
        onClick={onAnother}
        className="mt-3 w-full text-center text-[13px] font-medium text-ash hover:text-ink"
      >
        Reserve another
      </button>
      <p className="mt-4 text-[11px] leading-relaxed text-ash">
        {delivery === "local"
          ? "Saved in this browser only. Clearing this browser's data loses it, and the code is the only copy."
          : "Also saved in this browser, so the code works even if you lose the email."}{" "}
        Prices and dates on this page are engineering targets for a box that has not been built.
      </p>
    </section>
  );
}

/** Arrow keys move selection through the radios inside the group, wrapping at the ends. */
function onRadioKeys(e: KeyboardEvent<HTMLDivElement>) {
  const forward = e.key === "ArrowDown" || e.key === "ArrowRight";
  const back = e.key === "ArrowUp" || e.key === "ArrowLeft";
  if (!forward && !back && e.key !== "Home" && e.key !== "End") return;
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  const i = radios.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0 || radios.length === 0) return;
  e.preventDefault();
  const n = forward
    ? (i + 1) % radios.length
    : back
      ? (i - 1 + radios.length) % radios.length
      : e.key === "Home"
        ? 0
        : radios.length - 1;
  radios[n].focus();
  radios[n].click();
}

function Group({
  title,
  note,
  kind,
  children,
}: {
  title: string;
  note?: string;
  kind: "radio" | "checkbox";
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section className="mt-10">
      <h2 id={`${id}-title`} className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ash">
        {title}
      </h2>
      {note && (
        <p id={`${id}-note`} className="mt-1 text-[13px] text-ash">
          {note}
        </p>
      )}
      <div
        role={kind === "radio" ? "radiogroup" : "group"}
        aria-labelledby={`${id}-title`}
        aria-describedby={note ? `${id}-note` : undefined}
        onKeyDown={kind === "radio" ? onRadioKeys : undefined}
        className="mt-3 space-y-2"
      >
        {children}
      </div>
    </section>
  );
}

function Option({
  selected,
  onSelect,
  label,
  detail,
  meta,
  price,
  checkbox = false,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  detail?: string;
  meta?: string;
  price: string;
  checkbox?: boolean;
}) {
  return (
    <button
      type="button"
      role={checkbox ? "checkbox" : "radio"}
      aria-checked={selected}
      // Radios use a roving tab stop: Tab lands on the chosen one, arrows move within.
      tabIndex={checkbox ? undefined : selected ? 0 : -1}
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-4 rounded-[10px] border px-4 py-3.5 text-left transition-colors ${
        selected ? "border-ink bg-white" : "border-ink/10 bg-white/60 hover:border-ink/30"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{label}</span>
        {detail && <span className="mt-0.5 block text-[13px] text-ash">{detail}</span>}
        {meta && <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.12em] text-ash">{meta}</span>}
      </span>
      <span className="shrink-0 text-[14px] font-medium">{price}</span>
    </button>
  );
}

function Row({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${muted ? "text-ash" : ""}`}>
      <dt className={strong ? "font-medium" : ""}>{label}</dt>
      <dd className={`shrink-0 text-right ${strong ? "font-display text-[18px] font-medium" : "font-medium"}`}>{value}</dd>
    </div>
  );
}
