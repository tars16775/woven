export const dynamic = "force-static";
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";

type Entry = MetadataRoute.Sitemap[number];
type Meta = Pick<Entry, "changeFrequency" | "priority">;

const product: Meta = { changeFrequency: "weekly", priority: 0.9 };
const story: Meta = { changeFrequency: "monthly", priority: 0.7 };
const company: Meta = { changeFrequency: "monthly", priority: 0.4 };

/** Every public, indexable route with how often it moves. Auth and dashboard routes are deliberately absent. */
export const publicRoutes: Record<string, Meta> = {
  "/": { changeFrequency: "weekly", priority: 1 },
  "/core": product,
  "/core-plus": product,
  "/core-pro": product,
  "/order": product,
  "/tandem": story,
  "/home": story,
  "/privacy": story,
  "/founding-homes": { changeFrequency: "weekly", priority: 0.6 },
  "/support": { changeFrequency: "monthly", priority: 0.5 },
  "/developers": { changeFrequency: "monthly", priority: 0.5 },
  "/mac": { changeFrequency: "weekly", priority: 0.8 },
  "/status": { changeFrequency: "weekly", priority: 0.7 },
  "/legal": { changeFrequency: "yearly", priority: 0.2 },
  "/press": company,
  "/careers": company,
  "/contact": company,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return Object.entries(publicRoutes).map(([path, meta]) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    lastModified,
    ...meta,
  }));
}
