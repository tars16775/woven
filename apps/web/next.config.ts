import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The project lives on an external volume whose filesystem writes
    // AppleDouble sidecars into Next's image cache during development, which
    // corrupts optimized responses. Serve originals in dev; optimize in prod.
    unoptimized: process.env.NODE_ENV === "development",
  },
};

export default nextConfig;
