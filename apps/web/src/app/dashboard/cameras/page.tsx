import type { Metadata } from "next";
import { CamerasView } from "./view";

export const metadata: Metadata = { title: "Cameras" };

export default function CamerasPage() {
  return <CamerasView />;
}
