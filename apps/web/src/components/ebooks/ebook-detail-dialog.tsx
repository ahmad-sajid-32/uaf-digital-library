import {
  BookOpen,
  CalendarDays,
  Eye,
  FileText,
  Globe2,
  KeyRound,
  Languages,
  Library,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { EBookAccessScopeBadge } from "@/components/ebooks/ebook-access-scope-badge";
import { EBookCoverImage } from "@/components/ebooks/ebook-cover-image";
import { EBookStatusBadge } from "@/components/ebooks/ebook-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { labelToken, type EBook } from "@/lib/ebooks";

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function EBookDetailDialog({ ebook }: { ebook: EBook }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="size-9 rounded-xl px-0 sm:h-8 sm:w-auto sm:px-3"
          aria-label="View E-Book details"
          title="View E-Book details"
        >
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">View</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-border/70 p-0 sm:max-w-5xl">
        <div className="border-b border-border/60 bg-gradient-to-br from-primary/10 via-background to-muted/40 px-6 py-6 sm:px-8">
          <DialogHeader className="pr-8 text-left">
            <div className="flex flex-wrap gap-2">
              <EBookStatusBadge status={ebook.status} />
              <EBookAccessScopeBadge scope={ebook.access_scope} />
              {ebook.file ? (
                <Badge variant="outline">
                  {ebook.file.file_format.toUpperCase()}
                </Badge>
              ) : null}
            </div>
            <DialogTitle className="font-display text-2xl font-black tracking-tight sm:text-3xl">
              {ebook.title}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 text-sm">
              <UserRound className="h-4 w-4" />
              {ebook.authors}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-6 px-6 pb-7 sm:px-8 lg:grid-cols-[15rem_1fr]">
          <EBookCoverImage ebook={ebook} variant="hero" />
          <div className="space-y-5">
            <Card className="rounded-3xl border-border/60 py-0 shadow-none">
              <CardContent className="space-y-3 px-5 py-5">
                <div className="flex items-center gap-2 font-semibold">
                  <BookOpen className="h-5 w-5 text-primary" />
                  About this E-Book
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  {ebook.description ||
                    "No description is available for this E-Book."}
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem
                icon={Library}
                label="Category"
                value={labelToken(ebook.category)}
              />
              <DetailItem
                icon={Languages}
                label="Language"
                value={ebook.language}
              />
              <DetailItem
                icon={CalendarDays}
                label="Publication"
                value={
                  ebook.publication_year
                    ? String(ebook.publication_year)
                    : "Not provided"
                }
              />
              <DetailItem
                icon={Globe2}
                label="Publisher"
                value={ebook.publisher || "Not provided"}
              />
              <DetailItem
                icon={KeyRound}
                label="ISBN"
                value={ebook.isbn || "Not provided"}
              />
              <DetailItem
                icon={FileText}
                label="File"
                value={
                  ebook.file
                    ? `${ebook.file.file_format.toUpperCase()} - ${labelToken(ebook.file.file_status)}`
                    : "No file uploaded"
                }
              />
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Access settings
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Preview is {ebook.allow_preview ? "enabled" : "disabled"} and
                download is {ebook.allow_download ? "enabled" : "disabled"}.
              </p>
            </div>

            {ebook.file?.validation_error ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-destructive">
                {ebook.file.validation_error}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
