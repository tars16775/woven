"use client";

import { Component, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { useWebGL } from "./webgl";
import { VisuallyHidden } from "../visually-hidden";

const IO_SUPPORTED = typeof window !== "undefined" && "IntersectionObserver" in window;

/**
 * Whether `ref` is within `rootMargin` of the viewport. Browsers without
 * IntersectionObserver are treated as always in view.
 */
export function useInView<T extends Element>(ref: RefObject<T | null>, rootMargin = "0px"): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !IO_SUPPORTED) return;
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) setInView(last.isIntersecting);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return IO_SUPPORTED ? inView : true;
}

function subscribeVisibility(cb: () => void) {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}
const pageVisible = () => document.visibilityState !== "hidden";
const serverVisible = () => true;

/** Whether the document is currently visible (not a background tab). */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, pageVisible, serverVisible);
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type Props = {
  className?: string;
  /** Short accessible name for the picture. */
  label: string;
  /** Full description of what the scene shows; read after the label. */
  description: string;
  /** Shown when WebGL is unavailable or the scene throws. */
  fallback: ReactNode;
  /** Distance from the viewport at which the scene starts rendering. */
  rootMargin?: string;
  /** The WebGL scene; `active` is false when the stage is off-screen or the tab is hidden. */
  children: (active: boolean) => ReactNode;
};

/**
 * The frame every WebGL scene sits in. It owns the accessible name and
 * description (the canvas itself is hidden from assistive technology), picks
 * the CSS fallback when WebGL is missing or fails, and tells the scene to stop
 * rendering when it is off-screen or the tab is in the background.
 */
export function CanvasStage({ className = "", label, description, fallback, rootMargin = "35% 0px", children }: Props) {
  const gl = useWebGL();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, rootMargin);
  const visible = usePageVisible();
  const descId = useId();

  let content: ReactNode;
  if (gl === null) {
    // Server render and first client paint: hold the space, show the light.
    content = (
      <div className="flex h-full w-full items-center justify-center">
        <span className="orb" style={{ ["--orb" as string]: "14px" }} />
      </div>
    );
  } else if (gl) {
    content = <Boundary fallback={fallback}>{children(inView && visible)}</Boundary>;
  } else {
    content = fallback;
  }

  return (
    <div ref={ref} className={`relative ${className}`} role="img" aria-label={label} aria-describedby={descId}>
      {content}
      <VisuallyHidden as="p" id={descId}>
        {description}
      </VisuallyHidden>
    </div>
  );
}
