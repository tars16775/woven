import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
