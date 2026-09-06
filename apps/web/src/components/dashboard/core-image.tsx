"use client";

import { useCoreUrl } from "@/lib/core/transport";

/** An image from the Core: straight from the signed address at home, through the tunnel when away. */
export function CoreImage({ src, alt, className, loading }: { src: string; alt: string; className?: string; loading?: "lazy" | "eager" }) {
  const url = useCoreUrl(src);
  if (!url) return <span className={`block bg-chassis ${className ?? ""}`} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element -- bytes come from the household's own Core, never a CDN
  return <img src={url} alt={alt} loading={loading} className={className} />;
}
