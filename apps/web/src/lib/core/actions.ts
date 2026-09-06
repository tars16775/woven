"use client";

import { ActionRecord, GateStatus, HomeState, type PrepareRequest } from "@woven/schema";
import { z } from "zod";
import { CoreError } from "./client";
import { coreClient } from "./store";
import { NoCoreError } from "./identity";

/**
 * Actions, the home and the Gate against the connected Core (phases 12 to
 * 15). Every call carries the session cookie. Nothing here runs without a
 * Core; the preview pages keep their own local state.
 */
async function call<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const c = coreClient();
  if (!c) throw new NoCoreError();
  const res = await fetch(`${c.base}${path}`, { ...init, credentials: "include", cache: "no-store", headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...(init.headers ?? {}) } });
  if (!res.ok) {
    let message = "";
    try {
      message = ((await res.json()) as { error?: string }).error ?? "";
    } catch {}
    throw new CoreError(res.status, message);
  }
  return schema.parse(await res.json());
}
const post = (body?: unknown): RequestInit => ({ method: "POST", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

export const actions = {
  /** Prepare and, if the policy allows it outright, execute. Read `status` to know which. */
  run: (req: PrepareRequest) => call("/v1/actions/run", ActionRecord, post(req)),
  prepare: (req: PrepareRequest) => call("/v1/actions/prepare", ActionRecord, post(req)),
  approve: (id: string, assertion?: { key: string; credential: Record<string, unknown> }) => call(`/v1/actions/${id}/approve`, ActionRecord, post(assertion ? { assertion } : {})),
  decline: (id: string) => call(`/v1/actions/${id}/decline`, ActionRecord, post()),
  execute: (id: string) => call(`/v1/actions/${id}/execute`, ActionRecord, post()),
  pending: () => call("/v1/actions?status=prepared&limit=20", z.object({ actions: z.array(ActionRecord) })).then((r) => r.actions),
  recent: (limit = 20) => call(`/v1/actions?limit=${limit}`, z.object({ actions: z.array(ActionRecord) })).then((r) => r.actions),
};

export const home = {
  state: () => call("/v1/home", HomeState),
  setPresence: (adultsHome: boolean) => call("/v1/home/presence", HomeState.shape.presence, post({ adultsHome })),
};

export const gate = {
  status: () => call("/v1/gate", GateStatus),
  set: (open: boolean) => call("/v1/gate", GateStatus, post({ open })),
};

/** One line for a toast or a card from what the Core said about an action. */
export function describe(a: ActionRecord): string {
  switch (a.status) {
    case "succeeded":
      return `${a.preview.replace(/\.$/, "")} · done · receipt written`;
    case "prepared":
      return `${a.preview.replace(/\.$/, "")} · waiting for approval (${a.decision.reason})`;
    case "declined":
      return `Not allowed: ${a.decision.reason}`;
    case "failed":
      return `Failed: ${a.error ?? a.decision.reason}`;
    case "expired":
      return "That approval expired.";
    default:
      return a.preview;
  }
}

export function explainAction(err: unknown): string {
  if (err instanceof NoCoreError) return "Your Core is not reachable right now.";
  if (err instanceof CoreError) return err.message || "The Core refused that.";
  return err instanceof Error ? err.message : "Something went wrong.";
}

export type { ActionRecord, GateStatus, HomeState };
