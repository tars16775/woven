import type { Metadata } from "next";
import { AskChat } from "./chat";

export const metadata: Metadata = { title: "Ask" };

export default function AskPage() {
  return <AskChat />;
}
