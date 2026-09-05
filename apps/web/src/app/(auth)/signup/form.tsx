"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { signIn } from "@/lib/auth";

type FieldKey = "house" | "name" | "email";

const field =
  "mt-1.5 w-full rounded-[10px] border bg-white px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-ink disabled:opacity-60";

export function SignupForm() {
  const router = useRouter();
  const uid = useId();
  const [step, setStep] = useState<1 | 2>(1);
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
    setBusy(true);
    // The real flow calls navigator.credentials.create against the box and
    // registers the public key with your Core over the home network. Until a
    // Core exists, the session is simulated on this device and nothing is sent.
    await new Promise((r) => setTimeout(r, 800));
    signIn({ household: house.trim(), name: name.trim(), email: clean, method: "passkey", simulated: true });
    router.replace("/dashboard");
  };

  const errorId = (k: FieldKey) => `${uid}-${k}-error`;

  return (
    <div>
      <p className="text-[13px] font-medium text-ash">Set up · step {step} of 2</p>
      <h1 className="mt-2 font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em]">
        {step === 1 ? "Name the house." : "Make your key."}
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ash">
        {step === 1
          ? "This is the household everyone in it will share. You are its first person and its owner."
          : "A passkey lives on this device and never leaves it. There is no password to remember or to lose."}
      </p>

      {step === 1 ? (
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
            <p className="mt-3 border-t border-ink/8 pt-3 text-[12px] text-ash">
              In this preview, steps 1 and 2 are simulated on this device. Your key is not made yet;
              a session is saved in this browser and nothing is sent anywhere.
            </p>
          </div>
          <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn btn-primary w-full disabled:opacity-60">
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
