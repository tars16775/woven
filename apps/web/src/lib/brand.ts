/**
 * One place for the site's public identity. Every address and absolute URL
 * on the site derives from these, so moving to the real domain is one edit
 * (or one environment variable).
 */
const rawUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://woven.example";

export const SITE_URL = rawUrl.replace(/\/+$/, "");
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

/** Mail domain follows the site host unless overridden. */
const mailDomain = process.env.NEXT_PUBLIC_MAIL_DOMAIN || SITE_HOST;

export const email = {
  hello: `hello@${mailDomain}`,
  support: `support@${mailDomain}`,
  security: `security@${mailDomain}`,
  developers: `developers@${mailDomain}`,
  press: `press@${mailDomain}`,
  jobs: `jobs@${mailDomain}`,
  founding: `founding@${mailDomain}`,
  founders: `founders@${mailDomain}`,
  legal: `legal@${mailDomain}`,
} as const;

/** Whether the public domain is still the placeholder. Used to show a small notice. */
export const isPlaceholderDomain = SITE_HOST === "woven.example";
