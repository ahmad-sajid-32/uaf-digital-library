import { StudentEBookAccessCard } from "@/components/student-ebooks/student-ebook-access-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EBook, EBookAccessEventType } from "@/lib/ebooks";

export function StudentEBookDetailPanel({ ebook, onAccess }: { ebook: EBook | null; onAccess: (type: EBookAccessEventType) => void }) {
  if (!ebook) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Select an E-Book to view its details.</CardContent></Card>;
  return <Card><CardHeader><CardTitle>{ebook.title}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="font-medium">{ebook.authors}</p><p className="text-sm leading-6 text-muted-foreground">{ebook.description || "No description is available."}</p><StudentEBookAccessCard ebook={ebook} onAccess={onAccess} /></CardContent></Card>;
}
