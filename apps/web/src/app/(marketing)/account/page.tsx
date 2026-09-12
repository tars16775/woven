import type { Metadata } from "next";
import { PageFrame } from "@/components/page-frame";
import { AccountView } from "./view";

export const metadata: Metadata = { title: "Your Woven account", robots: { index: false } };

/**
 * A person's account with Woven the company: what they reserved, what they
 * applied for, how to reach us. Deliberately not their house. A house signs
 * its people in at /login, against the box itself, and nothing inside it is
 * ever sent here.
 */
export default function AccountPage() {
  return (
    <PageFrame
      eyebrow="Account"
      title="Your account with Woven."
      intro="Reservations, applications and support, in one place. This is your relationship with the company, not with your house: your house signs you in under Sign in, and nothing from inside it comes here."
    >
      <AccountView />
    </PageFrame>
  );
}
