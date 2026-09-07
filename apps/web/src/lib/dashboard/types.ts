/**
 * The shapes the dashboard renders. There is no sample household behind them
 * any more: every screen reads its own Core, and when there is no Core the
 * shell says so instead of drawing a house that does not exist.
 */
export type Where = "local" | "cloud" | "device" | "policy";

export type ActivityItem = {
  id: string;
  /** HH:MM */
  time: string;
  day: "today" | "yesterday";
  kind: "tandem" | "cameras" | "backup" | "gate" | "home" | "agent" | "core";
  title: string;
  detail: string;
  where: Where;
  actor: string;
  sent?: string;
};
