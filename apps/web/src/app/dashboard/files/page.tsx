import type { Metadata } from "next";
import { FilesView } from "./view";

export const metadata: Metadata = { title: "Files" };

export default function FilesPage() {
  return <FilesView />;
}
