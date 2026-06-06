import { BookOpen, CalendarDays, FileText, Languages, Library, UserRound } from "lucide-react";

import { EBookAccessScopeBadge } from "@/components/ebooks/ebook-access-scope-badge";
import { EBookCoverImage } from "@/components/ebooks/ebook-cover-image";
import { StudentEBookAccessCard } from "@/components/student-ebooks/student-ebook-access-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { labelToken, type EBook, type EBookAccessEventType } from "@/lib/ebooks";

function MetadataTile({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="rounded-2xl border border-border/60 bg-background/75 p-3"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Icon className="h-3.5 w-3.5 text-primary" />{label}</div><p className="mt-2 text-sm font-semibold">{value}</p></div>;
}

export function StudentEBookDetailPanel({
  ebook,
  onAccess,
  previewPending,
  downloadPending,
}: {
  ebook: EBook | null;
  onAccess: (type: EBookAccessEventType) => void;
  previewPending: boolean;
  downloadPending: boolean;
}) {
  if (!ebook) return <Card className="rounded-3xl border-dashed border-border/70 py-0 shadow-none"><CardContent className="px-6 py-12 text-center"><BookOpen className="mx-auto h-8 w-8 text-primary" /><p className="mt-4 font-semibold">Choose an E-Book</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Select a cover card to review its details and available reading actions.</p></CardContent></Card>;
  return (
    <Card className="sticky top-6 rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 px-5 py-5">
        <EBookCoverImage ebook={ebook} variant="hero" className="mx-auto max-w-[15rem]" />
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2"><Badge variant="secondary" className="rounded-full">{labelToken(ebook.category)}</Badge><EBookAccessScopeBadge scope={ebook.access_scope} /><Badge variant="outline" className="rounded-full">{ebook.file?.file_format.toUpperCase() || "E-Book"}</Badge></div>
          <CardTitle className="font-display text-2xl font-black leading-tight tracking-tight">{ebook.title}</CardTitle>
          <CardDescription className="flex items-center gap-2 px-0"><UserRound className="h-4 w-4" />{ebook.authors}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-5 py-5">
        <div><div className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4 text-primary" />About this E-Book</div><p className="mt-2 text-sm leading-7 text-muted-foreground">{ebook.description || "No description is available for this E-Book."}</p></div>
        <Separator />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <MetadataTile icon={Library} label="Category" value={labelToken(ebook.category)} />
          <MetadataTile icon={Languages} label="Language" value={ebook.language} />
          <MetadataTile icon={FileText} label="Format" value={ebook.file?.file_format.toUpperCase() || "Not available"} />
          <MetadataTile icon={CalendarDays} label="Published" value={ebook.publication_year ? String(ebook.publication_year) : "Not provided"} />
        </div>
        <StudentEBookAccessCard ebook={ebook} onAccess={onAccess} previewPending={previewPending} downloadPending={downloadPending} />
      </CardContent>
    </Card>
  );
}
