"use client";

import { CamerasState } from "@woven/schema";
import { z } from "zod";
import { CoreError } from "./client";
import { NoCoreError } from "./identity";
import { coreClient } from "./store";
import { signedUrl } from "./device";
import { coreFetch } from "./transport";

/**
 * The camera client (dashboard design phase 14).
 *
 * Written before the Core has these routes, which is the point of designing
 * first: this file is the specification the backend will be built to. A Core
 * that does not answer `/v1/cameras` yet is not a bug and not an error to
 * show a person — it is simply a Core without capture, and `state()` says so
 * rather than throwing, so the room renders its honest empty state.
 */

function base(): string {
  const c = coreClient();
  if (!c) throw new NoCoreError();
  return c.base;
}

async function call<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  base();
  const res = await coreFetch(path, { ...init, cache: "no-store", headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...(init.headers ?? {}) } });
  if (!res.ok) {
    let message = "";
    try {
      message = ((await res.json()) as { error?: string }).error ?? "";
    } catch {}
    throw new CoreError(res.status, message);
  }
  return schema.parse(await res.json());
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

/** A Core with no camera routes at all, expressed as the state it really is in. */
const NO_CAPTURE: CamerasState = { capture: "absent", pausedAll: false, cameras: [], events: [] };

export const cameras = {
  /**
   * Everything the room needs in one read. A 404 means this Core predates the
   * camera routes, which is the same situation as a Core with no capture
   * hardware, so it is reported as that rather than as a failure.
   */
  async state(): Promise<CamerasState> {
    try {
      return await call("/v1/cameras", CamerasState);
    } catch (err) {
      if (err instanceof CoreError && (err.status === 404 || err.status === 501)) return NO_CAPTURE;
      throw err;
    }
  },

  /**
   * Stop or resume every camera at once. Pausing is one act on the household,
   * not a switch per camera, because "are the cameras off?" is a question
   * with one answer.
   */
  pauseAll: (paused: boolean) => call("/v1/cameras/pause", z.object({ pausedAll: z.boolean() }), post({ paused })),

  /** Turn detection on or off for one camera, without stopping the stream. */
  setDetection: (id: string, on: boolean) => call(`/v1/cameras/${id}/detection`, z.object({ detection: z.boolean() }), post({ detection: on })),

  /** How many days of clips this camera keeps before the box deletes them. */
  setRetention: (id: string, days: number) => call(`/v1/cameras/${id}/retention`, z.object({ retentionDays: z.number() }), post({ days })),

  /** A still from the live stream, refreshed by changing `t`. */
  snapshotUrl: (id: string, t = Date.now()) => signedUrl(base(), `/v1/cameras/${id}/snapshot?t=${t}`),

  /** The clip for one event, played in place; never uploaded anywhere. */
  clipUrl: (eventId: string) => signedUrl(base(), `/v1/cameras/events/${eventId}/clip`),
};
