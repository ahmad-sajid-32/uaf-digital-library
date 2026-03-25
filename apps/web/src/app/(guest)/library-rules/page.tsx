import type { Metadata } from "next";

import { LibraryRulesPage } from "@/components/legal/library-rules-page";

export const metadata: Metadata = {
  title: "Library Rules | UAF Smart E-Library",
  description:
    "Operational library rules and conduct guidance for the UAF Smart E-Library & University Information Assistant.",
};

export default function LibraryRulesRoute() {
  return <LibraryRulesPage />;
}
