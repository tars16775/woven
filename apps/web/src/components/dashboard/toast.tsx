"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; text: string };
type Say = (text: string) => void;

const ToastContext = createContext<Say>(() => {});

/**
 * One live region for the whole dashboard. Toasts are short confirmations
 * of things the box just did; they dismiss themselves after a few seconds.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  const say = useCallback<Say>((text) => {
    const id = ++seq.current;
    setItems((it) => [...it.slice(-2), { id, text }]);
    window.setTimeout(() => setItems((it) => it.filter((t) => t.id !== id)), 3400);
  }, []);

  return (
    <ToastContext.Provider value={say}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="dash-lock max-w-full rounded-full bg-graphite px-4 py-2 text-[13px] text-bone shadow-lg ring-1 ring-white/10"
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Say {
  return useContext(ToastContext);
}
