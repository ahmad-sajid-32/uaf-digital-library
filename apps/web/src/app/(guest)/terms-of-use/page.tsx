import type { Metadata } from "next";

import { TermsOfUsePage } from "@/components/legal/terms-of-use-page";

export const metadata: Metadata = {
  title: "Terms of Use | UAF Smart E-Library",
  description:
    "Institutional service conditions for the UAF Smart E-Library & University Information Assistant.",
};

export default function TermsOfUseRoute() {
  return <TermsOfUsePage />;
}
