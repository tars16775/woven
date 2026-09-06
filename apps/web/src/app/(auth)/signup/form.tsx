"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { signIn } from "@/lib/auth";
import { explain, identity, sessionRecord } from "@/lib/core/identity";
import { startCore, useCore } from "@/lib/core/store";

type FieldKey = "house" | "name" | "email";

const field =
  "mt-1.5 w-full rounded-[10px] border bg-white px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-ink disabled:opacity-60";

export function SignupForm() {
  const router = useRouter();
  const uid = useId();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const core = useCore();
  const connected = core.phase === "connected";
  const [existing, setExisting] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    startCore();
  }, []);
  useEffect(() => {
    if (!connected) return;
    let alive = true;
    identity
      .setupState()
      .then((h) => alive && setExisting(h.setup ? h.name : null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [connected]);
  const [house, setHouse] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [busy, setBusy] = useState(false);
  const houseRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Focus lands on the first field with an error, in form order.
  const focusFirst = (errs: Partial<Record<FieldKey, string>>) => {
    if (errs.house) houseRef.current?.focus();
    else if (errs.name) nameRef.current?.focus();
    else if (errs.email) emailRef.current?.focus();
  };

  const clear = (k: FieldKey) => {
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const next = (e: FormEvent) => {
    e.preventDefault();
    const errs: Partial<Record<FieldKey, string>> = {};
    if (!house.trim()) errs.house = "Give the house a name.";
    if (!name.trim()) errs.name = "Tell us your name.";
    setErrors(errs);
    if (errs.house || errs.name) {
      focusFirst(errs);
      return;
    }
    setStep(2);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const clean = email.trim();
    if (!clean.includes("@") || clean.startsWith("@") || clean.endsWith("@")) {
      const errs = { email: "Enter an email you can recover the house with." };
      setErrors(errs);
      focusFirst(errs);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    if (connected) {
      // The Core creates the house; this device makes the owner's first passkey; the codes are shown once.
      try {
        const { session, recoveryCodes: codes } = await identity.setup({ household: house.trim(), owner: { name: name.trim(), email: clean } });
        signIn(sessionRecord(session, "passkey"));
        setRecoveryCodes(codes);
        setStep(3);
      } catch (err) {
        setFailure(explain(err));
      } finally {
        setBusy(false);
      }
      return;
    }
    // Preview without a Core: the session is simulated on this device and nothing is sent.
    await new Promise((r) => setTimeout(r, 800));
    signIn({ household: house.trim(), name: name.trim(), email: clean, method: "passkey", simulated: true });
    router.replace("/dashboard");
  };

  const errorId = (k: FieldKey) => `${uid}-${k}-error`;

  return (
    <div>
      <p className="text-[13px] font-medium text-ash">Set up · step {step} of {connected ? 3 : 2}</p>
      <h1 className="mt-2 font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em]">
        {step === 1 ? "Name the house." : step === 2 ? "Make your key." : "Write these down."}
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ash">
        {step === 1
          ? "This is the household everyone in it will share. You are its first person and its owner."
          : step === 2
            ? "A passkey lives on this device and never leaves it. There is no password to remember or to lose."
            : "Eight recovery codes, each good once. They are the only way back in if every device is lost. The Core will not show them again."}
      </p>

      {connected && existing && step !== 3 && (
        <div role="status" className="mt-6 rounded-[12px] bg-white p-4 text-[13px] ring-1 ring-ink/5" data-testid="house-exists">
          <div className="font-medium">This Core already runs {existing}.</div>
          <p className="mt-1 text-ash">
            A box holds one household. Ask its owner to invite you, or{" "}
            <Link href="/login" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
              sign in
            </Link>
            .
          </p>
        </div>
      )}

      {step === 3 ? (
        <div className="mt-8">
          <ol className="grid grid-cols-2 gap-2 rounded-[12px] bg-white p-4 font-mono text-[15px] ring-1 ring-ink/5" data-testid="recovery-codes">
            {recoveryCodes.map((c) => (
              <li key={c} className="rounded-[8px] bg-bone px-3 py-2 text-center tracking-wider">
                {c}
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => router.replace("/dashboard")} className="btn btn-primary mt-5 w-full">
            I have written them down
          </button>
          <p className="mt-3 text-center text-[12px] text-ash">You can make a new set from Settings at any time; the old set stops working.</p>
        </div>
      ) : step === 1 ? (
        <form onSubmit={next} className="mt-8 space-y-4" noValidate>
          <div>
            <label htmlFor={`${uid}-house`} className="block text-[13px] font-medium text-ash">
              House name
            </label>
            <input
              id={`${uid}-house`}
              ref={houseRef}
              value={house}
              onChange={(e) => {
                setHouse(e.target.value);
                clear("house");
              }}
              autoComplete="off"
              placeholder="The Okafor house"
              aria-invalid={errors.house ? true : undefined}
              aria-describedby={errors.house ? errorId("house") : undefined}
              className={`${field} ${errors.house ? "border-[#a13a2a]" : "border-ink/10"}`}
            />
            {errors.house && (
              <p id={errorId("house")} role="alert" className="mt-2 text-[13px] text-[#a13a2a]">
                {errors.house}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${uid}-name`} className="block text-[13px] font-medium text-ash">
              Your name
            </label>
            <input
              id={`${uid}-name`}
              ref={nameRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clear("name");
              }}
              autoComplete="given-name"
              placeholder="How the house should call you"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? errorId("name") : undefined}
              className={`${field} ${errors.name ? "border-[#a13a2a]" : "border-ink/10"}`}
            />
            {errors.name && (
              <p id={errorId("name")} role="alert" className="mt-2 text-[13px] text-[#a13a2a]">
                {errors.name}
              </p>
            )}
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Continue
          </button>
        </form>
      ) : (
        <form onSubmit={create} className="mt-8 space-y-4" noValidate>
          <div>
            <label htmlFor={`${uid}-email`} className="block text-[13px] font-medium text-ash">
              Email, for recovery only
            </label>
            <input
              id={`${uid}-email`}
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clear("email");
              }}
              autoComplete="email"
              placeholder="you@example.com"
              disabled={busy}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? errorId("email") : undefined}
              className={`${field} ${errors.email ? "border-[#a13a2a]" : "border-ink/10"}`}
            />
            {errors.email && (
              <p id={errorId("email")} role="alert" className="mt-2 text-[13px] text-[#a13a2a]">
                {errors.email}
              </p>
            )}
          </div>
          <div className="rounded-[12px] bg-white p-4 text-[13px] ring-1 ring-ink/5">
            <div className="font-medium">What happens next</div>
            <ol className="mt-2 space-y-1.5 text-ash">
              <li>1. Your device asks for your face, fingerprint or PIN.</li>
              <li>2. A key is made here and registered with your Core over the home network.</li>
              <li>3. You land in the dashboard. Nothing about you has left the house.</li>
            </ol>
            {!connected && (
              <p className="mt-3 border-t border-ink/8 pt-3 text-[12px] text-ash">
                In this preview, steps 1 and 2 are simulated on this device. Your key is not made yet;
                a session is saved in this browser and nothing is sent anywhere.
              </p>
            )}
          </div>
          {failure && (
            <p role="alert" className="text-[13px] text-[#a13a2a]">
              {failure}
            </p>
          )}
          <button type="submit" disabled={busy || Boolean(connected && existing)} aria-busy={busy || undefined} className="btn btn-primary w-full disabled:opacity-60">
            {busy ? "Making your key…" : "Create passkey and finish"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setErrors({});
              setStep(1);
            }}
            className="w-full text-center text-[13px] font-medium text-ash hover:text-ink disabled:opacity-60"
          >
            Back
          </button>
        </form>
      )}

      <div className="hairline mt-8 border-t pt-6 text-[13px] text-ash">
        Already have a house?{" "}
        <Link href="/login" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
          Sign in
        </Link>
      </div>
    </div>
  );
}
