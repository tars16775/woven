"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useT } from "@/lib/i18n";
import { signIn, useSession } from "@/lib/auth";
import { explain, identity, sessionRecord } from "@/lib/core/identity";
import { startCore, useCore, whenSettled } from "@/lib/core/store";
import { NoCorePaths } from "../no-core-paths";

type Mode = "passkey" | "code" | "recovery";

const field =
  "mt-1.5 w-full rounded-[10px] border bg-white px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-ink disabled:opacity-60 aria-[invalid=true]:border-[#a13a2a]";

export function LoginForm() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const session = useSession();
  const uid = useId();
  const ids = {
    email: `${uid}-email`,
    emailError: `${uid}-email-error`,
    name: `${uid}-name`,
    codeLabel: `${uid}-code-label`,
    codeHint: `${uid}-code-hint`,
    codeError: `${uid}-code-error`,
  };

  const core = useCore();
  const connected = core.phase === "connected";
  const unreachable = core.phase === "unreachable" || core.phase === "off";
  const [houseReady, setHouseReady] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("passkey");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Already signed in: go straight through.
  useEffect(() => {
    if (session) router.replace(next);
  }, [session, router, next]);

  // Find the Core, and ask it whether a house exists yet.
  useEffect(() => {
    startCore();
  }, []);
  useEffect(() => {
    if (!connected) return;
    let alive = true;
    identity
      .setupState()
      .then((h) => alive && setHouseReady(h.setup))
      .catch(() => alive && setHouseReady(null));
    return () => {
      alive = false;
    };
  }, [connected]);

  const arrive = (view: Awaited<ReturnType<typeof identity.loginWithPasskey>>, method: "passkey" | "recovery") => {
    signIn(sessionRecord(view, method));
    router.replace(next);
  };

  const passkey = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const clean = email.trim();
    if (!clean.includes("@") || clean.startsWith("@") || clean.endsWith("@")) {
      setError("Enter the email you set up the house with.");
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    // Someone can type faster than the network answers; wait for the search first.
    if ((await whenSettled()).phase !== "connected") {
      setBusy(false);
      setError("No Core is answering, so there is no house to sign in to.");
      return;
    }
    // The Core sends a challenge; this device signs it; the Core answers with a session cookie.
    try {
      arrive(await identity.loginWithPasskey(clean), "passkey");
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  const recover = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const clean = email.trim();
    if (!clean.includes("@")) {
      setError("Enter the email you set up the house with.");
      emailRef.current?.focus();
      return;
    }
    if (code.replace(/[^a-z0-9]/gi, "").length < 8) {
      setError("Enter one of the codes you wrote down, or the rescue code you were given.");
      return;
    }
    setBusy(true);
    if ((await whenSettled()).phase !== "connected") {
      setBusy(false);
      setError("No Core is answering, so there is nothing to recover into.");
      return;
    }
    try {
      arrive(await identity.recover(clean, code), "recovery");
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (d: string[]) => {
    if (busy) return;
    setCodeError(null);
    if (!name.trim()) {
      setCodeError("Tell us your name so the house knows who is signing in.");
      nameRef.current?.focus();
      return;
    }
    const missing = d.findIndex((x) => !x);
    if (missing >= 0) {
      setCodeError("Enter all six digits from the screen on your Core.");
      inputs.current[missing]?.focus();
      return;
    }
    setBusy(true);
    if ((await whenSettled()).phase !== "connected") {
      setBusy(false);
      setCodeError("No Core is answering, so there is no code to check.");
      return;
    }
    // The box matches the digits against the code on its screen and answers with a session.
    try {
      const view = await identity.loginWithCode(name.trim(), d.join(""));
      signIn(sessionRecord(view, "code"));
      router.replace(next);
    } catch (err) {
      setCodeError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  const onCodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitCode(digits);
  };

  const onDigit = (i: number, v: string) => {
    const c = v.replace(/\D/g, "").slice(-1);
    const d = [...digits];
    d[i] = c;
    setDigits(d);
    if (codeError) setCodeError(null);
    if (c && i < 5) inputs.current[i + 1]?.focus();
    if (d.every((x) => x) && name.trim()) void submitCode(d);
  };

  const onDigitKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      inputs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      inputs.current[i + 1]?.focus();
    }
  };

  const complete = digits.every((x) => x);

  return (
    <div>
      <p className="text-[13px] font-medium text-ash">Sign in</p>
      <h1 className="mt-2 font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em]">Reach your house.</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ash">
        Use the passkey on this device, or the six-digit code showing on the front of your Core.
      </p>

      {!connected && <NoCorePaths />}

      {connected && houseReady === false && (
        <div role="status" className="mt-6 rounded-[12px] bg-white p-4 text-[13px] ring-1 ring-ink/5" data-testid="no-house-yet">
          <div className="font-medium">Your Core is here, but it has no house yet.</div>
          <p className="mt-1 text-ash">
            Set one up first, then come back to sign in.{" "}
            <Link href="/signup" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
              Set up a house
            </Link>
          </p>
        </div>
      )}

      <div className="mt-8 flex rounded-[10px] bg-white p-1 ring-1 ring-ink/8" role="tablist" aria-label="Sign-in method">
        {(["passkey", "code", "recovery"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`${uid}-tab-${m}`}
            aria-selected={mode === m}
            aria-controls={`${uid}-panel-${m}`}
            onClick={() => {
              setMode(m);
              setError(null);
              setCodeError(null);
            }}
            className={`flex-1 rounded-[8px] py-2 text-[13px] font-medium transition-colors ${mode === m ? "bg-ink text-bone" : "text-ink/70 hover:text-ink"}`}
          >
            {m === "passkey" ? t("login.tab.passkey") : m === "code" ? t("login.tab.code") : t("login.tab.recovery")}
          </button>
        ))}
      </div>

      {mode === "passkey" ? (
        <form
          id={`${uid}-panel-passkey`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-passkey`}
          onSubmit={passkey}
          className="mt-6"
          noValidate
        >
          <label htmlFor={ids.email} className="block text-[13px] font-medium text-ash">
            Email
          </label>
          <input
            id={ids.email}
            ref={emailRef}
            type="email"
            autoComplete="username webauthn"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? ids.emailError : undefined}
            className={`${field} ${error ? "border-[#a13a2a]" : "border-ink/10"}`}
            placeholder="you@example.com"
          />
          {error && (
            <p id={ids.emailError} role="alert" className="mt-3 text-[13px] text-[#a13a2a]">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || unreachable} aria-busy={busy || undefined} className="btn btn-primary mt-5 w-full disabled:opacity-60">
            {busy ? "Waiting for your device…" : "Continue with passkey"}
          </button>
          <p className="mt-3 text-center text-[12px] text-ash">
            {connected ? `Face, fingerprint or device PIN, checked by your Core at ${core.phase === "connected" ? new URL(core.url).hostname : "home"}.` : "Your Core checks the passkey. Nothing here can."}
          </p>
        </form>
      ) : mode === "recovery" ? (
        <form id={`${uid}-panel-recovery`} role="tabpanel" aria-labelledby={`${uid}-tab-recovery`} onSubmit={recover} className="mt-6" noValidate>
          <label htmlFor={`${ids.email}-r`} className="block text-[13px] font-medium text-ash">
            Email
          </label>
          <input
            id={`${ids.email}-r`}
            ref={emailRef}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            disabled={busy}
            className={`${field} border-ink/10`}
            placeholder="you@example.com"
          />
          <label htmlFor={`${uid}-recovery-code`} className="mt-4 block text-[13px] font-medium text-ash">
            Recovery code
          </label>
          <input
            id={`${uid}-recovery-code`}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            disabled={busy}
            autoComplete="one-time-code"
            spellCheck={false}
            className={`${field} border-ink/10 font-mono`}
            placeholder="kq7m-v3xz"
          />
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-[#a13a2a]">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || unreachable} aria-busy={busy || undefined} className="btn btn-primary mt-5 w-full disabled:opacity-60">
            {busy ? t("login.checking") : t("login.recoveryButton")}
          </button>
          <p className="mt-3 text-center text-[12px] text-ash">One of the codes you wrote down, or a rescue code another adult in the house just gave you. Each works once; add a passkey on this device right after.</p>
        </form>
      ) : (
        <form
          id={`${uid}-panel-code`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-code`}
          onSubmit={onCodeSubmit}
          className="mt-6"
          noValidate
        >
          <label htmlFor={ids.name} className="block text-[13px] font-medium text-ash">
            Your name
          </label>
          <input
            id={ids.name}
            ref={nameRef}
            type="text"
            autoComplete="given-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (codeError) setCodeError(null);
            }}
            disabled={busy}
            aria-invalid={codeError && !name.trim() ? true : undefined}
            aria-describedby={codeError ? ids.codeError : undefined}
            className={`${field} ${codeError && !name.trim() ? "border-[#a13a2a]" : "border-ink/10"}`}
            placeholder="How the house should call you"
          />

          <p id={ids.codeLabel} className="mt-5 text-[13px] font-medium text-ash">
            Tap the screen on your Core, then enter the code it shows
          </p>
          <div
            role="group"
            aria-labelledby={ids.codeLabel}
            aria-describedby={codeError ? ids.codeError : ids.codeHint}
            className="mt-3 flex gap-2"
            onPaste={(e) => {
              const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
              if (t.length === 6) {
                e.preventDefault();
                const d = t.split("");
                setDigits(d);
                inputs.current[5]?.focus();
                if (name.trim()) void submitCode(d);
              }
            }}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1} of 6`}
                aria-invalid={codeError && name.trim() && !d ? true : undefined}
                value={d}
                disabled={busy}
                onChange={(e) => onDigit(i, e.target.value)}
                onKeyDown={(e) => onDigitKey(i, e)}
                className={`h-14 w-full rounded-[10px] border bg-white text-center font-mono text-[22px] outline-none transition-colors focus:border-ink disabled:opacity-60 ${
                  codeError && name.trim() && !d ? "border-[#a13a2a]" : "border-ink/10"
                }`}
              />
            ))}
          </div>
          {codeError ? (
            <p id={ids.codeError} role="alert" className="mt-3 text-[13px] text-[#a13a2a]">
              {codeError}
            </p>
          ) : (
            <p id={ids.codeHint} className="mt-3 text-[12px] text-ash" aria-live="polite">
              {busy
                ? "Checking with the box…"
                : "The code changes every minute and only works on your home network or through the Gate with your key."}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || unreachable}
            aria-busy={busy || undefined}
            className={`btn mt-5 w-full disabled:opacity-60 ${complete ? "btn-primary" : "btn-secondary"}`}
          >
            {busy ? "Checking with the box…" : "Sign in with the code"}
          </button>
        </form>
      )}

      <div className="hairline mt-8 border-t pt-6 text-[13px] text-ash">
        New here?{" "}
        <Link href="/signup" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
          Set up a house
        </Link>
      </div>
    </div>
  );
}
