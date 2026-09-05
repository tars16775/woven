import type { Metadata } from "next";
import { TVView } from "./view";

export const metadata: Metadata = { title: "TV" };

export default function TVPage() {
  return <TVView />;
}
