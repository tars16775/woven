import { AskAnswer, PilotNumbers, PrivacySummary } from "@woven/schema";
import { call } from "./actions";

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

/** Ask (gap 11): rules on the box until a model runs there. Never crosses the Gate. */
export const ask = {
  question: (question: string) => call("/v1/ask", AskAnswer, post({ question })),
};

/** The Privacy page's numbers, from the ledger and nothing else (gap 15). */
export const privacy = {
  summary: () => call("/v1/privacy/summary", PrivacySummary),
};

/** Numbers computed on the box at the moment they are asked for (gap 30). */
export const pilot = {
  numbers: () => call("/v1/pilot/numbers", PilotNumbers),
};

export type { AskAnswer, PilotNumbers, PrivacySummary };
