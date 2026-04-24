// apps/web/src/components/circulation/staff-circulation-screen.tsx
/**
 * Staff circulation-management screen for the authenticated shell.
 *
 * Purpose:
 * - Render the first real circulation supervision workspace for librarian and
 *   admin operators.
 * - Keep the screen truthful by loading the active, overdue, and history loan
 *   directories from the shared hook boundary and refining locally from the
 *   cached datasets.
 * - Expose selected-loan detail, return, due-date adjustment, and renew
 *   actions without inventing frontend-only circulation state transitions.
 */

"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  Eye,
  FilterX,
  LoaderCircle,
  RefreshCw,
  RotateCw,
  Search,
  Undo2,
} from "lucide-react";

import { CirculationDetailDialog } from "@/components/circulation/circulation-detail-dialog";
import { CirculationDueDateDialog } from "@/components/circulation/circulation-due-date-dialog";
import {
  CirculationLoanStateBadge,
  CirculationQueueBadge,
  CirculationRoleBadge,
} from "@/components/circulation/circulation-badges";
import { PageContainer } from "@/components/app-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  DateRangePicker,
  type DateRangePickerValue,
} from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { PaginationControl } from "@/components/ui/pagination-control";
import { RowsControl } from "@/components/ui/rows-control";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CIRCULATION_BOOK_STATUS_VALUES,
  CIRCULATION_ROLE_VALUES,
  getCirculationRoleLabel,
  getCirculationScopeLabel,
  type CirculationBookStatus,
  type CirculationRole,
  type CirculationScope,
  type StaffCirculationLoanDetailItem,
  type StaffCirculationLoanListItem,
} from "@/lib/circulation";
import {
  useRenewCirculationLoan,
  useReturnCirculationLoan,
  useStaffCirculationScopeView,
} from "@/hooks/useCirculation";
import { cn } from "@/lib/utils";

type ScopeTabId = CirculationScope;

type ActionableLoan = Pick<
  StaffCirculationLoanListItem,
  | "transaction_id"
  | "book_id"
  | "book_title"
  | "user_full_name"
  | "due_date"
  | "return_date"
  | "can_return"
  | "can_adjust_due_date"
  | "can_renew"
> &
  Partial<StaffCirculationLoanDetailItem>;

type RoleFilterValue = CirculationRole | "all";
type BookStatusFilterValue = CirculationBookStatus | "all";

const SCOPE_TABS: ScopeTabId[] = ["active", "overdue", "history"];

const SCOPE_COPY: Record<
  ScopeTabId,
  {
    title: string;
    summary: string;
    searchPlaceholder: string;
    emptyServerMessage: string;
    emptyFilteredMessage: string;
  }
> = {
  active: {
    title: "Active Loans",
    summary:
      "Track current borrowed books, due dates, and waiting-list activity in one table.",
    searchPlaceholder:
      "Search borrower, email, roll number, employee code, title, or transaction ID",
    emptyServerMessage:
      "No active loans exist right now. New borrowing activity will appear here automatically.",
    emptyFilteredMessage:
      "No active loans match the current search or filters. Change the filters to review other active circulation records.",
  },
  overdue: {
    title: "Overdue Loans",
    summary:
      "Review loans whose due dates have passed and confirm the resulting borrower, fine, and queue context.",
    searchPlaceholder:
      "Search overdue borrower, title, or exact transaction ID",
    emptyServerMessage:
      "No overdue loans exist right now. Once a due date passes without a return, the loan will appear here.",
    emptyFilteredMessage:
      "No overdue loans match the current search or filters. Change the filters to inspect other overdue records.",
  },
  history: {
    title: "Circulation History",
    summary:
      "Inspect returned transactions with their return timestamps, renewal counts, and any recorded fine state.",
    searchPlaceholder:
      "Search borrower, returned book, or exact transaction ID",
    emptyServerMessage:
      "No circulation history exists yet. Returned transactions will appear here once borrowing activity begins.",
    emptyFilteredMessage:
      "No history rows match the current search or filters. Change the filters to inspect other past circulation records.",
  },
};

function formatMoney(value: number | string): string {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not returned";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatRelativeTime(value: number | null): string {
  if (!value) {
    return "Not loaded yet";
  }

  const diffMinutes = Math.round((Date.now() - value) / 60000);

  if (diffMinutes <= 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} days ago`;
}

function titleCaseToken(value: string): string {
  return value
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function shortenId(value: string): string {
  if (value.length <= 13) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function FineStatusBadge(props: {
  fineStatus: StaffCirculationLoanListItem["fine_status"];
  fineAmount: StaffCirculationLoanListItem["fine_amount"];
}): React.JSX.Element {
  if (!props.fineStatus) {
    return (
      <Badge
        variant="outline"
        className="rounded-full border-border/60 bg-muted/55 px-2.5 py-1 text-muted-foreground dark:bg-muted/35"
      >
        No fine
      </Badge>
    );
  }

  const classes =
    props.fineStatus === "pending"
      ? "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15"
      : props.fineStatus === "paid"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
        : "border-border/60 bg-muted/55 text-muted-foreground dark:bg-muted/35";

  return (
    <Badge variant="outline" className={`rounded-full px-2.5 py-1 ${classes}`}>
      {props.fineStatus === "paid" ? "Paid" : titleCaseToken(props.fineStatus)}
      {props.fineStatus === "pending"
        ? ` - ${formatMoney(props.fineAmount)}`
        : ""}
    </Badge>
  );
}

function CirculationLoadingState(): React.JSX.Element {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-14 rounded-3xl" />
      <Skeleton className="h-112 rounded-3xl" />
    </div>
  );
}

function CirculationFailureState(props: {
  hasStaleData: boolean;
  message: string;
  onRetry: () => void | Promise<void>;
}): React.JSX.Element {
  return (
    <Card className="rounded-3xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
      <CardContent className="flex flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">
              Retry Required
            </p>
          </div>
          <p className="text-lg font-black text-foreground">
            Unable to load the circulation directory.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              The currently shown circulation data may be stale. Retry to fetch
              the latest information.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2 self-start rounded-xl sm:self-auto"
          onClick={() => {
            void props.onRetry();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function ActionEntryButton(props: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "due" | "renew" | "return";
}): React.JSX.Element {
  const Icon = props.icon;
  const toneClassName =
    props.tone === "due"
      ? "border-sky-500/25 bg-sky-500/8 text-sky-700 hover:border-sky-500/35 hover:bg-sky-500/12 hover:text-sky-700 dark:text-sky-300"
      : props.tone === "renew"
        ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 hover:border-emerald-500/35 hover:bg-emerald-500/12 hover:text-emerald-700 dark:text-emerald-300"
        : props.tone === "return"
          ? "border-primary/25 bg-primary/8 text-primary hover:border-primary/35 hover:bg-primary/14 hover:text-primary dark:bg-primary/12 dark:text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={props.disabled}
      className={cn(
        "size-9 rounded-xl px-0 sm:h-9 sm:w-auto sm:px-3",
        toneClassName,
      )}
      onClick={props.onClick}
      aria-label={props.label}
      title={props.label}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{props.label}</span>
    </Button>
  );
}

function CirculationScopeTable(props: {
  scope: ScopeTabId;
  loading: boolean;
  refreshing: boolean;
  fetchedAt: number | null;
  searchTerm: string;
  role: RoleFilterValue;
  bookStatus: BookStatusFilterValue;
  dueDateRange: DateRangePickerValue;
  hasAppliedFilters: boolean;
  serverTotalItems: number;
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  items: StaffCirculationLoanListItem[];
  onSearchChange: (value: string) => void;
  onRoleChange: (value: RoleFilterValue) => void;
  onBookStatusChange: (value: BookStatusFilterValue) => void;
  onDueDateRangeChange: (value: DateRangePickerValue) => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onView: (loan: StaffCirculationLoanListItem) => void;
  onAdjustDueDate: (loan: StaffCirculationLoanListItem) => void;
  onReturn: (loan: StaffCirculationLoanListItem) => void;
  onRenew: (loan: StaffCirculationLoanListItem) => void;
}): React.JSX.Element {
  const copy = SCOPE_COPY[props.scope];
  const isServerEmpty = props.serverTotalItems === 0;
  const emptyEyebrow = isServerEmpty ? "Directory Empty" : "Empty Result";
  const emptyTitle = isServerEmpty
    ? `No ${copy.title.toLowerCase()} exist right now.`
    : `No ${copy.title.toLowerCase()} match the current filters.`;
  const emptyMessage = isServerEmpty
    ? copy.emptyServerMessage
    : copy.emptyFilteredMessage;

  return (
    <Card className="rounded-3xl border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-section-title font-display font-black tracking-tight">
                {copy.title}
              </CardTitle>
              <Badge
                variant="outline"
                className="rounded-full border-primary/20 bg-primary/10 text-primary dark:border-primary/35 dark:bg-primary/15 dark:text-primary-foreground"
              >
                {props.totalItems} shown
              </Badge>
              {props.refreshing ? (
                <Badge
                  variant="outline"
                  className="rounded-full border-sky-500/20 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300"
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Refreshing
                </Badge>
              ) : null}
            </div>
            <CardDescription className="px-0 text-sm leading-6">
              {copy.summary}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-full border-border/60 bg-muted/40 text-muted-foreground"
            >
              Updated {formatRelativeTime(props.fetchedAt)}
            </Badge>
            {props.hasAppliedFilters ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2 rounded-xl"
                onClick={props.onResetFilters}
              >
                <FilterX className="h-4 w-4" />
                Clear Filters
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 items-end gap-3 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={props.searchTerm}
              onChange={(event) => {
                props.onSearchChange(event.target.value);
              }}
              placeholder={copy.searchPlaceholder}
              className="h-10 rounded-xl border-border/70 bg-background pl-9"
              aria-label={`Search ${copy.title.toLowerCase()}`}
            />
          </div>

          <Select
            value={props.role}
            onValueChange={(value) => {
              props.onRoleChange(value as RoleFilterValue);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background">
              <SelectValue placeholder="Role filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {CIRCULATION_ROLE_VALUES.map((roleValue) => (
                <SelectItem key={roleValue} value={roleValue}>
                  {getCirculationRoleLabel(roleValue)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={props.bookStatus}
            onValueChange={(value) => {
              props.onBookStatusChange(value as BookStatusFilterValue);
            }}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background">
              <SelectValue placeholder="Book status filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All book states</SelectItem>
              {CIRCULATION_BOOK_STATUS_VALUES.map((statusValue) => (
                <SelectItem key={statusValue} value={statusValue}>
                  {titleCaseToken(statusValue)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DateRangePicker
          label="Due Date Range"
          value={props.dueDateRange}
          onChange={props.onDueDateRangeChange}
          triggerClassName="h-10 rounded-xl border-border/70 bg-background"
        />
      </CardHeader>
      <CardContent className="space-y-3 px-2 py-2">
        {props.loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : props.totalItems === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 bg-muted/35 px-5 py-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {emptyEyebrow}
            </p>
            <p className="mt-3 text-lg font-black text-foreground">
              {emptyTitle}
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {emptyMessage}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-3xl border border-border/70">
              <Table>
                <TableHeader className="bg-muted/45">
                  <TableRow className="hover:bg-muted/45">
                    <TableHead className="w-20">Sr#</TableHead>
                    <TableHead className="min-w-52">Borrower</TableHead>
                    <TableHead className="min-w-64">Book</TableHead>
                    <TableHead className="min-w-52">Due</TableHead>
                    <TableHead className="w-36">Fine</TableHead>
                    <TableHead className="w-32">Queue</TableHead>
                    <TableHead className="w-48 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.items.map((item, index) => {
                    const serialNumber =
                      (props.page - 1) * props.pageSize + index + 1;

                    return (
                      <TableRow key={item.transaction_id}>
                        <TableCell className="font-semibold text-muted-foreground">
                          {serialNumber.toString().padStart(2, "0")}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">
                              {item.user_full_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.user_email ?? "Email not available"}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <CirculationRoleBadge role={item.user_role} />
                              {item.roll_number ? (
                                <span className="text-xs text-muted-foreground">
                                  Roll {item.roll_number}
                                </span>
                              ) : item.employee_code ? (
                                <span className="text-xs text-muted-foreground">
                                  Code {item.employee_code}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">
                              {item.book_title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.book_author}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <CirculationLoanStateBadge
                                returned={item.return_date !== null}
                                overdue={item.is_overdue}
                                bookStatus={item.book_status}
                              />
                              <span className="text-xs text-muted-foreground">
                                {titleCaseToken(item.book_category)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Txn {shortenId(item.transaction_id)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">
                              {formatDateTime(item.due_date)}
                            </p>
                            {item.return_date ? (
                              <p className="text-xs text-muted-foreground">
                                Returned {formatDateTime(item.return_date)}
                              </p>
                            ) : item.is_overdue ? (
                              <CirculationLoanStateBadge
                                returned={false}
                                overdue={true}
                                bookStatus={item.book_status}
                              />
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Renewal count {item.renewal_count}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <FineStatusBadge
                            fineStatus={item.fine_status}
                            fineAmount={item.fine_amount}
                          />
                        </TableCell>
                        <TableCell>
                          {item.waiting_count > 0 ? (
                            <div className="space-y-1">
                              <CirculationQueueBadge
                                waitingCount={item.waiting_count}
                                queueStatus={item.queue_status}
                              />
                              {item.queue_status ? (
                                <p className="text-xs text-muted-foreground">
                                  {titleCaseToken(item.queue_status)}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No queue
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <ActionEntryButton
                              label="View"
                              icon={Eye}
                              tone="neutral"
                              onClick={() => {
                                props.onView(item);
                              }}
                            />
                            <ActionEntryButton
                              label="Due"
                              icon={CalendarClock}
                              tone="due"
                              disabled={!item.can_adjust_due_date}
                              onClick={() => {
                                props.onAdjustDueDate(item);
                              }}
                            />
                            <ActionEntryButton
                              label="Renew"
                              icon={RotateCw}
                              tone="renew"
                              disabled={!item.can_renew}
                              onClick={() => {
                                props.onRenew(item);
                              }}
                            />
                            <ActionEntryButton
                              label="Return"
                              icon={Undo2}
                              tone="return"
                              disabled={!item.can_return}
                              onClick={() => {
                                props.onReturn(item);
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-3 pt-1">
              <RowsControl
                value={props.pageSize}
                options={props.pageSizeOptions}
                onValueChange={props.onPageSizeChange}
              />
              <PaginationControl
                page={props.page}
                totalPages={props.totalPages}
                onPageChange={props.onPageChange}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function StaffCirculationScreen(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState<ScopeTabId>("active");
  const [selectedTransactionId, setSelectedTransactionId] = React.useState<
    string | null
  >(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [dueDateLoan, setDueDateLoan] = React.useState<ActionableLoan | null>(
    null,
  );
  const [returnTarget, setReturnTarget] = React.useState<ActionableLoan | null>(
    null,
  );
  const [renewTarget, setRenewTarget] = React.useState<ActionableLoan | null>(
    null,
  );

  const activeView = useStaffCirculationScopeView("active", { autoLoad: true });
  const overdueView = useStaffCirculationScopeView("overdue", {
    autoLoad: true,
  });
  const historyView = useStaffCirculationScopeView("history", {
    autoLoad: true,
  });
  const {
    pending: returnPending,
    error: returnError,
    clearError: clearReturnError,
    returnLoan,
  } = useReturnCirculationLoan();
  const {
    pending: renewPending,
    error: renewError,
    clearError: clearRenewError,
    renewLoan,
  } = useRenewCirculationLoan();

  const viewMap = React.useMemo<Record<ScopeTabId, typeof activeView>>(
    () => ({
      active: activeView,
      overdue: overdueView,
      history: historyView,
    }),
    [activeView, overdueView, historyView],
  );
  const currentView = viewMap[activeTab];

  React.useEffect(() => {
    const candidate = searchParams.get("view");

    if (
      candidate === "active" ||
      candidate === "overdue" ||
      candidate === "history"
    ) {
      setActiveTab(candidate);
      return;
    }

    setActiveTab("active");
  }, [searchParams]);

  const syncTabToUrl = React.useCallback(
    (nextTab: ScopeTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", nextTab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleOpenDetail = React.useCallback(
    (loan: StaffCirculationLoanListItem) => {
      setSelectedTransactionId(loan.transaction_id);
      setDetailOpen(true);
    },
    [],
  );

  const handleOpenDueDate = React.useCallback((loan: ActionableLoan) => {
    setDetailOpen(false);
    setDueDateLoan(loan);
  }, []);

  const handleOpenReturn = React.useCallback((loan: ActionableLoan) => {
    setReturnTarget(loan);
  }, []);

  const handleOpenRenew = React.useCallback((loan: ActionableLoan) => {
    setRenewTarget(loan);
  }, []);

  const handleConfirmReturn = React.useCallback(async () => {
    if (!returnTarget) {
      return;
    }

    const success = await returnLoan(returnTarget.transaction_id, {
      relatedBookId: returnTarget.book_id,
    });

    if (success) {
      setReturnTarget(null);
    }
  }, [returnLoan, returnTarget]);

  const handleConfirmRenew = React.useCallback(async () => {
    if (!renewTarget) {
      return;
    }

    const success = await renewLoan(renewTarget.transaction_id, {
      relatedBookId: renewTarget.book_id,
    });

    if (success) {
      setRenewTarget(null);
    }
  }, [renewLoan, renewTarget]);

  const renderScopeTable = React.useCallback(
    (scope: ScopeTabId) => {
      const scopeView = viewMap[scope];

      if (scopeView.error && !scopeView.hasData) {
        return (
          <CirculationFailureState
            hasStaleData={scopeView.hasStaleData}
            message={scopeView.error}
            onRetry={scopeView.retry}
          />
        );
      }

      return (
        <div className="space-y-4">
          {scopeView.error && scopeView.hasData ? (
            <CirculationFailureState
              hasStaleData={scopeView.hasStaleData}
              message={scopeView.error}
              onRetry={scopeView.retry}
            />
          ) : null}

          <CirculationScopeTable
            scope={scope}
            loading={scopeView.loading}
            refreshing={scopeView.refreshing}
            fetchedAt={scopeView.fetchedAt}
            searchTerm={scopeView.filters.searchTerm}
            role={scopeView.filters.role}
            bookStatus={scopeView.filters.bookStatus}
            dueDateRange={scopeView.filters.dueDateRange}
            hasAppliedFilters={scopeView.hasAppliedFilters}
            serverTotalItems={scopeView.totalCount}
            totalItems={scopeView.filteredCount}
            totalPages={scopeView.totalPages}
            page={scopeView.filters.page}
            pageSize={scopeView.filters.pageSize}
            pageSizeOptions={scopeView.pageSizeOptions}
            items={scopeView.items}
            onSearchChange={scopeView.setSearchTerm}
            onRoleChange={scopeView.setRoleFilter}
            onBookStatusChange={scopeView.setBookStatusFilter}
            onDueDateRangeChange={scopeView.setDueDateRange}
            onResetFilters={scopeView.resetFilters}
            onPageChange={scopeView.setPage}
            onPageSizeChange={scopeView.setPageSize}
            onView={handleOpenDetail}
            onAdjustDueDate={handleOpenDueDate}
            onReturn={handleOpenReturn}
            onRenew={handleOpenRenew}
          />
        </div>
      );
    },
    [
      handleOpenDetail,
      handleOpenDueDate,
      handleOpenRenew,
      handleOpenReturn,
      viewMap,
    ],
  );

  return (
    <>
      <PageContainer
        eyebrow="Staff Operations"
        title="Circulation"
        description="Review active, overdue, and returned loans."
        actions={
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            disabled={currentView.loading || currentView.refreshing}
            onClick={() => {
              void currentView.refresh();
            }}
          >
            {currentView.loading || currentView.refreshing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        }
      >
        <ScrollReveal direction="up" delayMs={40}>
          {activeView.loading && overdueView.loading && historyView.loading ? (
            <CirculationLoadingState />
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                syncTabToUrl(value as ScopeTabId);
              }}
              className="flex min-h-0 flex-1 flex-col gap-4"
            >
              <div className="overflow-x-auto pb-1">
                <TabsList className="flex h-auto w-max min-w-full flex-nowrap rounded-[1.25rem] bg-muted/60 p-1.5 md:w-fit md:min-w-0 md:flex-wrap">
                  {SCOPE_TABS.map((scope) => {
                    const scopeView = viewMap[scope];

                    return (
                      <TabsTrigger
                        key={scope}
                        value={scope}
                        className="flex min-w-fit items-center gap-2 rounded-[0.9rem] px-4 py-2.5 text-sm font-semibold whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground"
                      >
                        <span>{getCirculationScopeLabel(scope)}</span>
                        <Badge
                          variant="secondary"
                          className="rounded-full border-0 bg-background/80 px-2 py-0.5 text-[11px] text-foreground"
                        >
                          {scopeView.totalCount}
                        </Badge>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {SCOPE_TABS.map((scope) => (
                <TabsContent
                  key={scope}
                  value={scope}
                  className="mt-0 min-h-0 flex-1"
                >
                  {renderScopeTable(scope)}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </ScrollReveal>
      </PageContainer>

      <CirculationDetailDialog
        transactionId={selectedTransactionId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAdjustDueDateRequested={handleOpenDueDate}
        onReturnRequested={handleOpenReturn}
        onRenewRequested={handleOpenRenew}
      />

      <CirculationDueDateDialog
        loan={dueDateLoan}
        open={Boolean(dueDateLoan)}
        onOpenChange={(open) => {
          if (!open) {
            setDueDateLoan(null);
          }
        }}
      />

      <AlertDialog
        open={Boolean(returnTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setReturnTarget(null);
            clearReturnError();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return Loan</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm the return of{" "}
              <span className="font-semibold text-foreground">
                {returnTarget?.book_title ?? "this book"}
              </span>{" "}
              for{" "}
              <span className="font-semibold text-foreground">
                {returnTarget?.user_full_name ?? "this borrower"}
              </span>
              . Returning may also update fines and waiting-list status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {returnError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {returnError}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={returnPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="border border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={returnPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmReturn();
              }}
            >
              {returnPending ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Returning...
                </>
              ) : (
                "Return Loan"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(renewTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRenewTarget(null);
            clearRenewError();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renew Loan</AlertDialogTitle>
            <AlertDialogDescription>
              Renew{" "}
              <span className="font-semibold text-foreground">
                {renewTarget?.book_title ?? "this book"}
              </span>{" "}
              for{" "}
              <span className="font-semibold text-foreground">
                {renewTarget?.user_full_name ?? "this borrower"}
              </span>
              . Renewal is applied only when this loan is eligible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {renewError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {renewError}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={renewPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="border border-emerald-500/30 bg-emerald-500 text-white hover:bg-emerald-500/90 dark:text-emerald-950"
              disabled={renewPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmRenew();
              }}
            >
              {renewPending ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Renewing...
                </>
              ) : (
                "Renew Loan"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
