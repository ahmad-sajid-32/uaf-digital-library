import { Button } from "@/components/ui/button";
import type { EBook, EBookAccessEventType } from "@/lib/ebooks";

export function StudentEBookAccessCard({ ebook, onAccess }: { ebook: EBook; onAccess: (type: EBookAccessEventType) => void }) {
  return <div className="flex flex-wrap gap-2">{ebook.allow_preview ? <Button onClick={() => onAccess("preview")}>Read Online</Button> : null}{ebook.allow_download ? <Button variant="outline" onClick={() => onAccess("download")}>Download</Button> : null}</div>;
}
