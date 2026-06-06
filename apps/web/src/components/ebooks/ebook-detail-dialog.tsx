import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { EBook } from "@/lib/ebooks";

export function EBookDetailDialog({ ebook }: { ebook: EBook }) {
  return <Dialog><DialogTrigger asChild><Button size="sm" variant="outline">View</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{ebook.title}</DialogTitle></DialogHeader><div className="space-y-2 text-sm"><p><strong>Authors:</strong> {ebook.authors}</p><p><strong>Language:</strong> {ebook.language}</p><p>{ebook.description || "No description is available."}</p>{ebook.file?.validation_error ? <p className="text-destructive">{ebook.file.validation_error}</p> : null}</div></DialogContent></Dialog>;
}
