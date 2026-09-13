import type { NextConfig } from "next";

/**
 * WOVEN_STATIC=1 exports the whole site as static files so the Core can
 * serve it from the box itself (one process, one address). The Railway
 * deploy builds the normal server output.
 */
const isStatic = process.env.WOVEN_STATIC === "1";

/**
 * The example house, served from this site's own origin.
 *
 * A Core issues a session cookie, and a browser only sends that cookie back
 * to the site that set it — Safari will not send it across sites at all. So
 * the hosted demonstration Core is proxied under this site's own path rather
 * than reached at an address of its own: same origin, nothing to configure in
 * a browser, and no certificate standing between a visitor and the house.
 *
 * WOVEN_DEMO_CORE_ORIGIN is the Core's real address, known to the server and
 * never to the page. Without it there is no demonstration and no route.
 */
const demoCore = process.env.WOVEN_DEMO_CORE_ORIGIN?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  ...(isStatic || !demoCore
    ? {}
    : {
        rewrites: async () => [{ source: "/demo-core/:path*", destination: `${demoCore}/:path*` }],
      }),
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
