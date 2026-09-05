import type { Metadata } from "next";
import { SignupForm } from "./form";

export const metadata: Metadata = { title: "Set up a house", robots: { index: false } };

export default function SignupPage() {
  return <SignupForm />;
}
