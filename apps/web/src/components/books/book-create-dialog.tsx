// apps/web/src/components/books/book-create-dialog.tsx
/**
 * Staff book creation dialog.
 *
 * Purpose:
 * - Provide one shell-native create flow for staff inventory management.
 * - Keep the create fields aligned with the backend contract instead of
 *   inventing unsupported inputs.
 */

"use client";

import * as React from "react";
import { BookPlus, LoaderCircle } from "lucide-react";

import { BookStatusBadge } from "@/components/books/book-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BOOK_CATEGORY_VALUES,
  getBookCategoryLabel,
  type BookCategory,
} from "@/lib/books";
import { useCreateBook } from "@/hooks/useBooks";

interface BookCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (params: { bookId: string }) => void;
}

interface CreateBookFormState {
  title: string;
  author: string;
  category: BookCategory;
  replacementCost: string;
  finePerDayRate: string;
  overrideBorrowDurationDays: string;
}

const DEFAULT_CREATE_FORM: CreateBookFormState = {
  title: "",
  author: "",
  category: "science",
  replacementCost: "",
  finePerDayRate: "",
  overrideBorrowDurationDays: "",
};

function getValidationMessage(form: CreateBookFormState): string | null {
  if (!form.title.trim()) {
    return "Title is required.";
  }

  if (!form.author.trim()) {
    return "Author is required.";
  }

  if (!form.replacementCost.trim()) {
    return "Replacement cost is required.";
  }

  const replacementCost = Number(form.replacementCost);

  if (Number.isNaN(replacementCost) || replacementCost < 0) {
    return "Replacement cost must be zero or greater.";
  }

  if (!form.finePerDayRate.trim()) {
    return "Fine per day rate is required.";
  }

  const finePerDayRate = Number(form.finePerDayRate);

  if (Number.isNaN(finePerDayRate) || finePerDayRate < 0) {
    return "Fine per day rate must be zero or greater.";
  }

  if (form.overrideBorrowDurationDays.trim()) {
    const overrideBorrowDurationDays = Number(form.overrideBorrowDurationDays);

    if (
      !Number.isInteger(overrideBorrowDurationDays) ||
      overrideBorrowDurationDays <= 0
    ) {
      return "Custom borrow duration must be a whole number greater than zero.";
    }
  }

  return null;
}

export function BookCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: BookCreateDialogProps): React.JSX.Element {
  const { pending, error, clearError, createBook } = useCreateBook();
  const [form, setForm] = React.useState<CreateBookFormState>({
    ...DEFAULT_CREATE_FORM,
  });
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (open) {
      return;
    }

    setForm({ ...DEFAULT_CREATE_FORM });
    setValidationError(null);
    clearError();
  }, [clearError, open]);

  const handleSubmit = React.useCallback(async () => {
    const message = getValidationMessage(form);

    if (message) {
      setValidationError(message);
      return;
    }

    setValidationError(null);

    const bookId = await createBook({
      title: form.title.trim(),
      author: form.author.trim(),
      category: form.category,
      replacement_cost: Number(form.replacementCost),
      fine_per_day_rate: Number(form.finePerDayRate),
      override_borrow_duration_days: form.overrideBorrowDurationDays.trim()
        ? Number(form.overrideBorrowDurationDays)
        : null,
    });

    if (!bookId) {
      return;
    }

    setForm({ ...DEFAULT_CREATE_FORM });
    onOpenChange(false);
    onCreated({ bookId });
  }, [createBook, form, onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-6xl lg:min-w-4xl overflow-y-auto rounded-3xl border-border/70 p-0">
        <div className="px-6 pb-6 pt-6">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="text-dialog-title font-display font-black tracking-tight">
              Add Book
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Create a new catalog record with the borrowing rules that staff
              already manages in the current backend contract.
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-5" />

          <div className="space-y-4">
            <Card className="border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_48%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))] py-0 shadow-none">
              <CardHeader className="px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <CardTitle className="text-dialog-title font-display font-black tracking-tight">
                      New Catalog Record
                    </CardTitle>
                    <CardDescription className="px-0 text-sm leading-6">
                      Fill the basic book identity and the lending rules that
                      control costs, fines, and optional custom duration.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full border-primary/20 bg-primary/5 text-primary"
                  >
                    Staff Flow
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {validationError ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {validationError}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Card className="border-border/60 bg-card/95 py-0 shadow-none">
              <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="create-book-title">Title</Label>
                  <Input
                    id="create-book-title"
                    value={form.title}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }));
                    }}
                    disabled={pending}
                    className="mt-2 rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="create-book-author">Author</Label>
                  <Input
                    id="create-book-author"
                    value={form.author}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        author: event.target.value,
                      }));
                    }}
                    disabled={pending}
                    className="mt-2 rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="create-book-category">Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) => {
                      setForm((current) => ({
                        ...current,
                        category: value as BookCategory,
                      }));
                    }}
                    disabled={pending}
                  >
                    <SelectTrigger
                      id="create-book-category"
                      className="mt-2 rounded-xl"
                    >
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {BOOK_CATEGORY_VALUES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {getBookCategoryLabel(category)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="create-book-replacement-cost">
                    Replacement Cost
                  </Label>
                  <Input
                    id="create-book-replacement-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={form.replacementCost}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        replacementCost: event.target.value,
                      }));
                    }}
                    disabled={pending}
                    className="mt-2 rounded-xl"
                  />
                </div>

                <div>
                  <Label htmlFor="create-book-fine-rate">
                    Fine Per Day Rate
                  </Label>
                  <Input
                    id="create-book-fine-rate"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={form.finePerDayRate}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        finePerDayRate: event.target.value,
                      }));
                    }}
                    disabled={pending}
                    className="mt-2 rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="create-book-override-days">
                    Custom Borrow Duration
                  </Label>
                  <Input
                    id="create-book-override-days"
                    type="number"
                    min={1}
                    step="1"
                    inputMode="numeric"
                    value={form.overrideBorrowDurationDays}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        overrideBorrowDurationDays: event.target.value,
                      }));
                    }}
                    disabled={pending}
                    className="mt-2 rounded-xl"
                  />
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Leave this blank to use the normal borrowing duration.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="mt-6 border-t border-border/60 pt-5">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={pending}
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-2 rounded-xl"
              disabled={pending}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <BookPlus className="h-4 w-4" />
              )}
              {pending ? "Creating..." : "Create Book"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
