export const dynamic = "force-static";
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";

/** Crawlers may index the public site; the dashboard, sign-in and order status are private. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/login", "/signup", "/join", "/order/status"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
