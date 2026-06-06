import { EBookCoverImage } from "@/components/ebooks/ebook-cover-image";
import { Card, CardContent } from "@/components/ui/card";
import { labelToken, type EBook } from "@/lib/ebooks";

export function StudentEBookCard({ ebook, selected, onSelect }: { ebook: EBook; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className="text-left">
      <Card className={selected ? "border-primary" : ""}><CardContent className="flex gap-4 p-4">
        <EBookCoverImage ebook={ebook} />
        <div><h2 className="font-bold">{ebook.title}</h2><p className="text-sm text-muted-foreground">{ebook.authors}</p><p className="mt-2 text-xs text-muted-foreground">{labelToken(ebook.category)} · {ebook.language}</p></div>
      </CardContent></Card>
    </button>
  );
}
