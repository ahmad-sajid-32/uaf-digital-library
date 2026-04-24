// apps/web/src/components/books/book-edit-dialog.tsx
/**
 * Staff book edit dialog.
 *
 * Purpose:
 * - Edit the fields that the current backend contract actually supports.
 * - Keep row-level destructive actions outside this dialog so the list remains
 *   the single delete command surface.
 */

"use client";

import * as React from "react";
import {
  AlertTriangle,
  CircleOff,
  LoaderCircle,
  Lock,
  RefreshCw,
} from "lucide-react";

import { BookStatusBadge } from "@/components/books/book-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BOOK_CATEGORY_VALUES,
  EDITABLE_BOOK_STATUS_VALUES,
  getBookCategoryLabel,
  getBookStatusLabel,
  type BookCategory,
  type EditableBookStatus,
  type StaffBookDetailItem,
  type UpdateBookPayload,
} from "@/lib/books";
import { useBookDetail, useUpdateBook } from "@/hooks/useBooks";

interface BookEditDialogProps {
  bookId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditBookFormState {
  title: string;
  author: string;
  category: BookCategory;
  status: EditableBookStatus;
  replacementCost: string;
  finePerDayRate: string;
  overrideBorrowDurationDays: string;
}

function formatDecimalInput(value: number | string): string {
  return String(value);
}

function toEditFormState(book: StaffBookDetailItem): EditBookFormState {
  return {
    title: book.title,
    author: book.author,
    category: book.category,
    status: book.status === "maintenance" ? "maintenance" : "available",
    replacementCost: formatDecimalInput(book.replacement_cost),
    finePerDayRate: formatDecimalInput(book.fine_per_day_rate),
    overrideBorrowDurationDays:
      book.override_borrow_duration_days !== null
        ? String(book.override_borrow_duration_days)
        : "",
  };
}

function isEditableStatus(book: StaffBookDetailItem): boolean {
  return book.status === "available" || book.status === "maintenance";
}

function getValidationMessage(
  book: StaffBookDetailItem,
  form: EditBookFormState,
): string | null {
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

  if (!form.overrideBorrowDurationDays.trim()) {
    if (book.override_borrow_duration_days !== null) {
      return "This form cannot remove an existing custom borrow duration. Keep a number here or leave the record unchanged.";
    }

    return null;
  }

  const overrideBorrowDurationDays = Number(form.overrideBorrowDurationDays);

  if (
    !Number.isInteger(overrideBorrowDurationDays) ||
    overrideBorrowDurationDays <= 0
  ) {
    return "Custom borrow duration must be a whole number greater than zero.";
  }

  return null;
}

function buildUpdatePayload(
  book: StaffBookDetailItem,
  form: EditBookFormState,
): UpdateBookPayload {
  const payload: UpdateBookPayload = {};
  const initialForm = toEditFormState(book);

  if (form.title !== initialForm.title) {
    payload.title = form.title.trim();
  }

  if (form.author !== initialForm.author) {
    payload.author = form.author.trim();
  }

  if (form.category !== initialForm.category) {
    payload.category = form.category;
  }

  if (isEditableStatus(book) && form.status !== initialForm.status) {
    payload.status = form.status;
  }

  if (form.replacementCost !== initialForm.replacementCost) {
    payload.replacement_cost = Number(form.replacementCost);
  }

  if (form.finePerDayRate !== initialForm.finePerDayRate) {
    payload.fine_per_day_rate = Number(form.finePerDayRate);
  }

  if (
    form.overrideBorrowDurationDays &&
    form.overrideBorrowDurationDays !== initialForm.overrideBorrowDurationDays
  ) {
    payload.override_borrow_duration_days = Number(
      form.overrideBorrowDurationDays,
    );
  }

  return payload;
}

function EditStateCard(props: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  message: string;
  onRetry?: () => void | Promise<void>;
}): React.JSX.Element {
  const Icon = props.icon;

  return (
    <Card className="border-border/60 bg-muted/35 py-0 shadow-none">
      <CardContent className="px-6 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {props.eyebrow}
        </p>
        <p className="mt-2 text-xl font-black text-foreground">{props.title}</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {props.message}
        </p>
        {props.onRetry ? (
          <Button
            type="button"
            variant="outline"
            className="mt-5 gap-2 rounded-xl"
            onClick={() => {
              void props.onRetry?.();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EditLoadingState(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 rounded-3xl" />
      <Skeleton className="h-72 rounded-3xl" />
    </div>
  );
}

export function BookEditDialog({
  bookId,
  open,
  onOpenChange,
}: BookEditDialogProps): React.JSX.Element {
  const { item, loading, error, errorStatus, hasData, refreshing, retry } =
    useBookDetail(bookId, {
      autoLoad: open,
    });
  const {
    pending: updatePending,
    error: updateError,
    clearError: clearUpdateError,
    updateBook,
  } = useUpdateBook();
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );
  const [form, setForm] = React.useState<EditBookFormState>({
    title: "",
    author: "",
    category: "science",
    status: "available",
    replacementCost: "",
    finePerDayRate: "",
    overrideBorrowDurationDays: "",
  });

  React.useEffect(() => {
    if (!item || !open) {
      return;
    }

    setForm(toEditFormState(item));
  }, [item, open]);

  React.useEffect(() => {
    if (open) {
      return;
    }

    setValidationError(null);
    clearUpdateError();
  }, [clearUpdateError, open]);

  const initialFormState = React.useMemo(
    () => (item ? toEditFormState(item) : null),
    [item],
  );
  const hasUnsavedChanges = React.useMemo(() => {
    if (!initialFormState) {
      return false;
    }

    return (
      form.title !== initialFormState.title ||
      form.author !== initialFormState.author ||
      form.category !== initialFormState.category ||
      form.status !== initialFormState.status ||
      form.replacementCost !== initialFormState.replacementCost ||
      form.finePerDayRate !== initialFormState.finePerDayRate ||
      form.overrideBorrowDurationDays !==
        initialFormState.overrideBorrowDurationDays
    );
  }, [form, initialFormState]);

  const handleSave = React.useCallback(async () => {
    if (!item || !hasUnsavedChanges || !bookId) {
      return;
    }

    const message = getValidationMessage(item, form);

    if (message) {
      setValidationError(message);
      return;
    }

    setValidationError(null);
    const payload = buildUpdatePayload(item, form);

    if (Object.keys(payload).length === 0) {
      return;
    }

    const success = await updateBook(bookId, payload);

    if (success) {
      onOpenChange(false);
    }
  }, [bookId, form, hasUnsavedChanges, item, onOpenChange, updateBook]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-6xl lg:min-w-4xl overflow-y-auto rounded-3xl border-border/70 p-0">
        <div className="px-6 pb-6 pt-6">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="text-dialog-title font-display font-black tracking-tight">
              Edit Book
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Update this catalog record without moving delete controls into the
              edit flow.
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-5" />

          {loading && !hasData ? <EditLoadingState /> : null}

          {!loading && !hasData && errorStatus === 404 ? (
            <EditStateCard
              icon={CircleOff}
              eyebrow="Not Found"
              title="This book record is no longer available."
              message={error ?? "The requested book could not be found."}
              onRetry={retry}
            />
          ) : null}

          {!loading && !hasData && errorStatus === 403 ? (
            <EditStateCard
              icon={Lock}
              eyebrow="Permission Denied"
              title="This book cannot be edited."
              message={error ?? "Your current account cannot update this book."}
              onRetry={retry}
            />
          ) : null}

          {!loading &&
          !hasData &&
          errorStatus !== 403 &&
          errorStatus !== 404 &&
          error ? (
            <EditStateCard
              icon={AlertTriangle}
              eyebrow="Retry Required"
              title="Unable to load this edit surface."
              message={error}
              onRetry={retry}
            />
          ) : null}

          {item ? (
            <div className="space-y-4">
              <Card className="border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_48%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))] py-0 shadow-none">
                <CardContent className="px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <p className="font-display text-2xl font-black tracking-tight text-foreground">
                        {item.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <BookStatusBadge status={item.status} />
                        {refreshing ? (
                          <Badge variant="secondary" className="rounded-full">
                            <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                            Refreshing
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Added {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {validationError ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {validationError}
                </div>
              ) : null}

              {updateError ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {updateError}
                </div>
              ) : null}

              <Card className="border-border/60 bg-card/95 py-0 shadow-none">
                <CardHeader className="px-5 py-5">
                  <CardTitle className="text-base font-black tracking-tight">
                    Editable Fields
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="edit-book-title">Title</Label>
                    <Input
                      id="edit-book-title"
                      value={form.title}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }));
                      }}
                      disabled={updatePending}
                      className="mt-2 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="edit-book-author">Author</Label>
                    <Input
                      id="edit-book-author"
                      value={form.author}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          author: event.target.value,
                        }));
                      }}
                      disabled={updatePending}
                      className="mt-2 rounded-xl"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-book-category">Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(value) => {
                        setForm((current) => ({
                          ...current,
                          category: value as BookCategory,
                        }));
                      }}
                      disabled={updatePending}
                    >
                      <SelectTrigger
                        id="edit-book-category"
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

                  {isEditableStatus(item) ? (
                    <div>
                      <Label htmlFor="edit-book-status">Status</Label>
                      <Select
                        value={form.status}
                        onValueChange={(value) => {
                          setForm((current) => ({
                            ...current,
                            status: value as EditableBookStatus,
                          }));
                        }}
                        disabled={updatePending}
                      >
                        <SelectTrigger
                          id="edit-book-status"
                          className="mt-2 rounded-xl"
                        >
                          <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                        <SelectContent>
                          {EDITABLE_BOOK_STATUS_VALUES.map((statusValue) => (
                            <SelectItem key={statusValue} value={statusValue}>
                              {getBookStatusLabel(statusValue)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="sm:col-span-2">
                      <Label htmlFor="edit-book-status-readonly">Status</Label>
                      <Input
                        id="edit-book-status-readonly"
                        value={getBookStatusLabel(item.status)}
                        readOnly
                        className="mt-2 rounded-xl"
                      />
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        This status is controlled by borrowing or reservation
                        activity, so it is not editable here.
                      </p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="edit-book-replacement-cost">
                      Replacement Cost
                    </Label>
                    <Input
                      id="edit-book-replacement-cost"
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
                      disabled={updatePending}
                      className="mt-2 rounded-xl"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-book-fine-rate">
                      Fine Per Day Rate
                    </Label>
                    <Input
                      id="edit-book-fine-rate"
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
                      disabled={updatePending}
                      className="mt-2 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="edit-book-override-days">
                      Custom Borrow Duration
                    </Label>
                    <Input
                      id="edit-book-override-days"
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
                      disabled={updatePending}
                      className="mt-2 rounded-xl"
                    />
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      A blank value keeps the normal duration only when no
                      custom duration is already stored.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <DialogFooter className="mt-6 items-center justify-between border-t border-border/60 pt-5 sm:flex-row sm:justify-between">
            <Badge
              variant={hasUnsavedChanges ? "outline" : "secondary"}
              className="rounded-full"
            >
              {hasUnsavedChanges ? "Unsaved changes" : "No changes yet"}
            </Badge>
            <Button
              type="button"
              className="gap-2 rounded-xl"
              disabled={!item || updatePending || !hasUnsavedChanges}
              onClick={() => {
                void handleSave();
              }}
            >
              {updatePending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
