import type { Metadata } from "next";
import { CoreView } from "./view";

export const metadata: Metadata = { title: "Core" };

export default function CorePage() {
  return <CoreView />;
}
