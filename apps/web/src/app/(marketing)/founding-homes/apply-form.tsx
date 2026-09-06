"use client";

import { useId, useRef, useState, type FormEvent, type Ref } from "react";
import { siteApi } from "@/lib/site-api";
import { saveApplication, useApplications } from "@/lib/applications";
import { useSession } from "@/lib/auth";

const setups = [
  "Home Assistant",
  "Ollama or another local model",
  "A NAS or home server",
  "Security cameras",
  "A robot vacuum or home robot",
  "None of these yet",
];

type Key = "name" | "email" | "city" | "people" | "why";
const order: Key[] = ["name", "email", "city", "people", "why"];

/**
 * Founding Homes application. There is no intake service yet, so the form
 * saves a draft on this device under a code and lets the person come back
 * and edit it. Nothing is sent, and the copy says so.
 */
export function ApplyForm() {
  const session = useSession();
  const apps = useApplications();
  const saved = apps?.[0];
  const uid = useId();

  const [editing, setEditing] = useState(false);
  // Overlay of what the person has typed this visit; below it, what was
  // saved; below that, the session. No effects needed to prefill.
  const [typed, setTyped] = useState<Partial<Record<Key, string>>>({});
  const [setup, setSetup] = useState<string[] | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [busy, setBusy] = useState(false);
  const [savedNow, setSavedNow] = useState(false);
  const refs = useRef<Partial<Record<Key, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const value = (k: Key): string => {
    if (typed[k] !== undefined) return typed[k] as string;
    if (saved) return saved[k];
    if (k === "name") return session?.name ?? "";
    if (k === "email") return session?.email ?? "";
    return "";
  };
  const setupValue = setup ?? saved?.setup ?? [];

  const set = (k: Key, v: string) => {
    setTyped((t) => ({ ...t, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const v = Object.fromEntries(order.map((k) => [k, value(k).trim()])) as Record<Key, string>;
    const errs: Partial<Record<Key, string>> = {};
    if (!v.name) errs.name = "Tell us your name.";
    if (!v.email || !v.email.includes("@") || v.email.startsWith("@") || v.email.endsWith("@"))
      errs.email = "Enter an email address we can reply to.";
    if (!v.city) errs.city = "Tell us the city the house is in.";
    if (v.people && !/^\d{1,2}$/.test(v.people)) errs.people = "A number from 1 to 12.";
    else if (v.people && (Number(v.people) < 1 || Number(v.people) > 12)) errs.people = "A number from 1 to 12.";
    setErrors(errs);
    const first = order.find((k) => errs[k]);
    if (first) {
      refs.current[first]?.focus();
      return;
    }
    setBusy(true);
    const app = saveApplication({ code: saved?.code, ...v, setup: setupValue });
    void siteApi.application({ code: app.code, name: app.name, email: app.email, city: app.city, people: app.people, setup: app.setup, why: app.why });
    setTyped({});
    setSetup(null);
    setEditing(false);
    setSavedNow(true);
    setBusy(false);
  };

  if (saved && !editing) {
    return (
      <div className="rounded-[14px] bg-white p-6 ring-1 ring-ink/5" aria-live="polite">
        <div className="flex items-center gap-2 text-[13px] font-medium text-local">
          <span className="block h-[6px] w-[6px] rounded-full bg-local" aria-hidden />
          {savedNow ? "Saved just now" : "Saved on this device"}
        </div>
        <div className="mt-3 font-display text-[24px] font-medium tracking-[-0.02em]">
          Your application is saved.
        </div>
        <p className="mt-2 text-[13px] text-ash">Application number</p>
        <p className="mt-1 font-mono text-[22px] tracking-[0.04em] text-ink">{saved.code}</p>
        <p className="mt-4 text-[15px] leading-relaxed text-ash">
          Your application is saved on this device. When applications open we will ask you to submit it;
          nothing has been sent yet.
        </p>
        <dl className="hairline mt-5 space-y-1.5 border-t pt-4 text-[13px]">
          <Pair k="Name" v={saved.name} />
          <Pair k="Email" v={saved.email} />
          <Pair k="City" v={saved.city} />
          {saved.people && <Pair k="People" v={saved.people} />}
          <Pair k="Already in the house" v={saved.setup.length ? saved.setup.join(", ") : "Nothing yet"} />
        </dl>
        <button
          type="button"
          onClick={() => {
            setSavedNow(false);
            setEditing(true);
          }}
          className="btn btn-secondary mt-5 w-full"
        >
          Edit your application
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-ash">
          Saved in this browser only. Come back here to change it any time before applications open.
        </p>
      </div>
    );
  }

  const input =
    "mt-1.5 w-full rounded-[10px] border bg-bone/60 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-ink disabled:opacity-60";
  const border = (k: Key) => (errors[k] ? "border-[#a13a2a]" : "border-ink/10");

  return (
    <form onSubmit={submit} className="rounded-[14px] bg-white p-6 ring-1 ring-ink/5" noValidate>
      {saved && (
        <p className="mb-5 text-[13px] text-ash">
          Editing <span className="font-mono text-ink">{saved.code}</span>. Saving keeps the same number.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${uid}-name`}
          label="Name"
          required
          autoComplete="name"
          value={value("name")}
          onChange={(v) => set("name", v)}
          error={errors.name}
          disabled={busy}
          ref={(el) => {
            refs.current.name = el;
          }}
        />
        <Field
          id={`${uid}-email`}
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={value("email")}
          onChange={(v) => set("email", v)}
          error={errors.email}
          disabled={busy}
          ref={(el) => {
            refs.current.email = el;
          }}
        />
        <Field
          id={`${uid}-city`}
          label="City"
          required
          autoComplete="address-level2"
          value={value("city")}
          onChange={(v) => set("city", v)}
          error={errors.city}
          disabled={busy}
          ref={(el) => {
            refs.current.city = el;
          }}
        />
        <Field
          id={`${uid}-people`}
          label="People in the household"
          type="number"
          min={1}
          max={12}
          inputMode="numeric"
          value={value("people")}
          onChange={(v) => set("people", v)}
          error={errors.people}
          disabled={busy}
          ref={(el) => {
            refs.current.people = el;
          }}
        />
      </div>

      <fieldset className="mt-6" disabled={busy}>
        <legend className="text-[13px] font-medium text-ash">What is already in the house?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {setups.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-ink/10 px-3.5 py-2.5 text-[14px] has-[:checked]:border-ink has-[:checked]:bg-bone"
            >
              <input
                type="checkbox"
                name="setup"
                value={s}
                checked={setupValue.includes(s)}
                onChange={(e) =>
                  setSetup(e.target.checked ? [...setupValue, s] : setupValue.filter((x) => x !== s))
                }
                className="accent-amber"
              />
              {s}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <label htmlFor={`${uid}-why`} className="block text-[13px] font-medium text-ash">
          What would you want the box to do on day one?
        </label>
        <textarea
          id={`${uid}-why`}
          ref={(el) => {
            refs.current.why = el;
          }}
          rows={4}
          value={value("why")}
          onChange={(e) => set("why", e.target.value)}
          disabled={busy}
          className={`${input} ${border("why")}`}
        />
      </div>

      <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn btn-primary mt-6 w-full disabled:opacity-60">
        {busy ? "Saving…" : saved ? "Save changes" : "Save your application"}
      </button>
      {saved && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setTyped({});
            setSetup(null);
            setErrors({});
            setEditing(false);
          }}
          className="mt-3 w-full text-center text-[13px] font-medium text-ash hover:text-ink disabled:opacity-60"
        >
          Discard changes
        </button>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-ash">
        Applications are not open yet. This saves a draft on this device under a code; when they open we will
        ask you to submit it. We use it to choose the pilot cohort and nothing else, and it is deleted after
        selection.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  required,
  value,
  onChange,
  error,
  ref,
  ...rest
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  ref?: Ref<HTMLInputElement>;
  autoComplete?: string;
  inputMode?: "numeric";
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-ash">
        {label}
        {required && (
          <>
            <span className="text-amber" aria-hidden>
              {" "}
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>
      <input
        id={id}
        ref={ref}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-1.5 w-full rounded-[10px] border bg-bone/60 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-ink disabled:opacity-60 ${
          error ? "border-[#a13a2a]" : "border-ink/10"
        }`}
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[12px] text-[#a13a2a]">
          {error}
        </p>
      )}
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ash">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
