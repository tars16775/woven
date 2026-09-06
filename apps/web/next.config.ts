import type { NextConfig } from "next";

/**
 * WOVEN_STATIC=1 exports the whole site as static files so the Core can
 * serve it from the box itself (one process, one address). The Railway
 * deploy builds the normal server output.
 */
const isStatic = process.env.WOVEN_STATIC === "1";

const nextConfig: NextConfig = {
  // The public site on Railway runs the standalone server; the box serves the static export.
  ...(isStatic ? { output: "export" as const, distDir: "out-build", trailingSlash: false } : { output: "standalone" as const }),
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: ["@woven/schema"],
  images: {
    // The project lives on an external volume whose filesystem writes
    // AppleDouble sidecars into Next's image cache during development, which
    // corrupts optimized responses. Serve originals in dev; optimize in prod.
    // A static export has no image server at all.
    unoptimized: process.env.NODE_ENV === "development" || isStatic,
  },
};

export default nextConfig;
