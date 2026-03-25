import type { Metadata } from "next";

import { PrivacyPolicyPage } from "@/components/legal/privacy-policy-page";

export const metadata: Metadata = {
  title: "Privacy Policy | UAF Smart E-Library",
  description:
    "Institutional privacy notice for the UAF Smart E-Library & University Information Assistant.",
};

export default function PrivacyPolicyRoute() {
  return <PrivacyPolicyPage />;
}
