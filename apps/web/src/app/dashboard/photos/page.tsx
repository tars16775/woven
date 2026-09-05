import type { Metadata } from "next";
import { PhotosView } from "./view";

export const metadata: Metadata = { title: "Photos" };

export default function PhotosPage() {
  return <PhotosView />;
}
