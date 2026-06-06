import { Badge } from "@/components/ui/badge";
import { labelToken, type EBookStatus } from "@/lib/ebooks";

export function EBookStatusBadge({ status }: { status: EBookStatus }) {
  return <Badge variant={status === "published" ? "default" : "secondary"}>{labelToken(status)}</Badge>;
}
