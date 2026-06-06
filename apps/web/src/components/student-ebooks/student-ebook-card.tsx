import { CheckCircle2, FileText } from "lucide-react";

import { EBookAccessScopeBadge } from "@/components/ebooks/ebook-access-scope-badge";
import { EBookCoverImage } from "@/components/ebooks/ebook-cover-image";
import { Badge } from "@/components/ui/badge";
import { labelToken, type EBook } from "@/lib/ebooks";
import { cn } from "@/lib/utils";

export function StudentEBookCard({ ebook, selected, onSelect }: { ebook: EBook; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "mx-auto w-full max-w-[18rem] rounded-3xl border p-3 text-left transition-all duration-200",
        "hover:border-primary/35 hover:bg-primary/5 hover:shadow-sm",
        selected ? "border-primary/30 bg-primary/10 shadow-sm shadow-primary/10" : "border-border/70 bg-background/80",
      )}
      aria-pressed={selected}
    >
      <div className="relative">
        <EBookCoverImage ebook={ebook} variant="card" className="w-full rounded-[1.5rem]" />
        <div className="absolute right-3 top-3"><Badge className="rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur hover:bg-background/90"><FileText className="h-3 w-3" />{ebook.file?.file_format.toUpperCase() || "E-Book"}</Badge></div>
      </div>
      <div className="mt-3 min-w-0 space-y-3 px-1 pb-1">
        <div className="space-y-1"><p className="line-clamp-2 text-base font-black leading-5 tracking-tight">{ebook.title}</p><p className="line-clamp-1 text-sm text-muted-foreground">{ebook.authors}</p></div>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary" className="rounded-full">{labelToken(ebook.category)}</Badge><EBookAccessScopeBadge scope={ebook.access_scope} />{selected ? <Badge variant="outline" className="rounded-full border-primary/30"><CheckCircle2 className="h-3 w-3" />Selected</Badge> : null}</div>
      </div>
    </button>
  );
}
