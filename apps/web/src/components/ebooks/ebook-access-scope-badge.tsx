import { Badge } from "@/components/ui/badge";
import { labelToken, type EBookAccessScope } from "@/lib/ebooks";

export function EBookAccessScopeBadge({ scope }: { scope: EBookAccessScope }) {
  return <Badge variant="outline">{labelToken(scope)}</Badge>;
}
