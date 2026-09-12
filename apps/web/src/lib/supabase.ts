"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A Woven account: the person's relationship with the company, not with
 * their house. Reservations, orders, support. It lives in Supabase and is
 * reached with the publishable key, so the browser can only ever see what
 * row security lets that person see, which is their own rows and nothing
 * else.
 *
 * This is not how anyone signs in to a Core. That happens at /login, against
 * the box itself, and nothing from it comes here. A site built without the
 * two public variables (the copy a Core serves inside a house) has no client
 * at all, and says so where it matters rather than pretending.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null | undefined;

/** The client, or null where accounts are not part of this build. Browser only. */
export function supabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (client === undefined) client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } }) : null;
  return client;
}

export const accountsAvailable = Boolean(url && key);

/** The signed-in person's access token, for the site API to attach a submission to them. Null when nobody is. */
export async function accessToken(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
