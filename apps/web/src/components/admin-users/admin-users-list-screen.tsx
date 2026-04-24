// apps/web/src/components/admin-users/admin-users-list-screen.tsx
/**
 * Admin users list screen for the authenticated admin shell.
 *
 * Purpose:
 * - Render the first real admin user-management screen inside the shared shell.
 * - Keep the L6 scope honest by delivering list management, local refinement,
 *   and truthful staged action entry points without faking later dialogs.
 */

"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCheck,
  UserRoundX,
  Eye,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  SquarePen,
  Trash2,
} from "lucide-react";

import {
  AdminUserCreateDialog,
  AdminUserDetailDialog,
  AdminUserEditDialog,
  AdminUserRoleBadge,
  AdminUserStatusBadge,
} from "@/components/admin-users";
import { PageContainer } from "@/components/app-shell";
import type { AdminManagedUser } from "@/lib/api/admin";
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
  useDeleteAdminUser,
  useUpdateAdminUserStatus,
  useAdminUsersTabsView,
  type AdminUsersActivityFilter,
} from "@/hooks/useAdmin";
import { cn } from "@/lib/utils";

type RoleTabId = "admin" | "librarian" | "student";

const ROLE_TAB_COPY: Record<
  RoleTabId,
  {
    title: string;
    summary: string;
    emptyServerMessage: string;
    emptyFilteredMessage: string;
  }
> = {
  admin: {
    title: "Admin accounts",
    summary:
      "Admin users to manage all system features and settings. Manage these accounts with care.",
    emptyServerMessage:
      "No admin accounts exist in the directory yet. Create the first admin record to populate this tab.",
    emptyFilteredMessage:
      "No admin accounts match the current search or status filters. Try to change the filters to get results.",
  },
  librarian: {
    title: "Librarian accounts",
    summary:
      "Operational library staff accounts for circulation and catalog workflows.",
    emptyServerMessage:
      "No librarian accounts exist in the directory yet. Create the first librarian record to populate this tab.",
    emptyFilteredMessage:
      "No librarian accounts match the current search or status filters. Try to change the filters to get results.",
  },
  student: {
    title: "Student accounts",
    summary:
      "Student accounts that students will use to allow borrowing and access to library resources.",
    emptyServerMessage:
      "No student accounts exist in the directory yet. Create the first student record to populate this tab.",
    emptyFilteredMessage:
      "No student accounts match the current search or status filters. Try to change the filters to get results.",
  },
};

function AdminUsersListLoadingState(): React.JSX.Element {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-14 rounded-[1.25rem]" />
      <Skeleton className="h-112 rounded-[1.75rem]" />
    </div>
  );
}

function AdminUsersListFailureState(props: {
  hasStaleData: boolean;
  message: string;
  onRetry: () => void | Promise<void>;
}): React.JSX.Element {
  return (
    <Card className="rounded-[1.75rem] border-danger/20 bg-danger/5 py-0 shadow-none">
      <CardContent className="flex flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-danger">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em]">
              Retry Required
            </p>
          </div>
          <p className="text-lg font-black text-foreground">
            Unable to load the users directory.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
          {props.hasStaleData ? (
            <p className="text-sm text-muted-foreground">
              Unable to load the users directory. Click retry to attempt
              fetching the latest data.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2 self-start sm:self-auto"
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

function RowActionButton(props: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "default" | "outline";
  danger?: boolean;
}): React.JSX.Element {
  const Icon = props.icon;

  return (
    <Button
      type="button"
      variant={props.variant ?? "outline"}
      size="sm"
      className={cn(
        "h-8 rounded-xl px-2 sm:h-9 sm:px-3",
        props.danger
          ? "border-danger/40 text-danger hover:border-danger/50 hover:bg-danger/10 hover:text-danger"
          : "gap-2",
      )}
      onClick={props.onClick}
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only sm:not-sr-only">{props.label}</span>
    </Button>
  );
}

function AdminUsersTabTable(props: {
  role: RoleTabId;
  loading: boolean;
  refreshing: boolean;
  searchTerm: string;
  activity: AdminUsersActivityFilter;
  hasAppliedFilters: boolean;
  serverTotalItems: number;
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  pagedItems: AdminManagedUser[];
  onSearchChange: (value: string) => void;
  onActivityChange: (value: AdminUsersActivityFilter) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onView: (userId: string) => void;
  onEdit: (userId: string) => void;
  onStatusAction: (user: AdminManagedUser) => void;
  onDeleteAction: (user: AdminManagedUser) => void;
}): React.JSX.Element {
  const copy = ROLE_TAB_COPY[props.role];
  const isServerEmpty = props.serverTotalItems === 0;
  const emptyEyebrow = isServerEmpty ? "Directory Empty" : "Empty Result";
  const emptyTitle = isServerEmpty
    ? `No ${props.role} records exist yet.`
    : "No rows match the current filters.";
  const emptyMessage = isServerEmpty
    ? copy.emptyServerMessage
    : copy.emptyFilteredMessage;

  return (
    <Card className="rounded-[1.75rem] border-border/60 bg-card/95 py-0 shadow-none">
      <CardHeader className="gap-4 border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-section-title font-display font-black tracking-tight">
              {copy.title}
            </CardTitle>
            <CardDescription className="px-0 text-sm leading-6">
              {copy.summary}
            </CardDescription>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_12rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={props.searchTerm}
                onChange={(event) => {
                  props.onSearchChange(event.target.value);
                }}
                placeholder={`Search ${props.role} records`}
                className="h-10 rounded-xl border-border/70 bg-background pl-9"
                aria-label={`Search ${props.role} users`}
              />
            </div>

            <Select
              value={props.activity}
              onValueChange={(value) => {
                props.onActivityChange(value as AdminUsersActivityFilter);
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl border-border/70 bg-background">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
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
                    <TableHead>Name</TableHead>
                    <TableHead className="w-36">Role</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-44 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.pagedItems.map((item, index) => {
                    const serialNumber =
                      (props.page - 1) * props.pageSize + index + 1;

                    return (
                      <TableRow key={item.user_id} className="">
                        <TableCell className="font-semibold text-muted-foreground">
                          {serialNumber.toString().padStart(2, "0")}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">
                              {item.full_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <AdminUserRoleBadge role={item.role} />
                        </TableCell>
                        <TableCell>
                          <AdminUserStatusBadge isActive={item.is_active} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <RowActionButton
                              label="View"
                              icon={Eye}
                              onClick={() => {
                                props.onView(item.user_id);
                              }}
                            />
                            <RowActionButton
                              label="Edit"
                              icon={SquarePen}
                              onClick={() => {
                                props.onEdit(item.user_id);
                              }}
                            />
                            <RowActionButton
                              label={
                                item.is_active ? "Deactivate" : "Reactivate"
                              }
                              icon={item.is_active ? UserRoundX : CheckCheck}
                              onClick={() => {
                                props.onStatusAction(item);
                              }}
                            />
                            <RowActionButton
                              label="Delete"
                              icon={Trash2}
                              onClick={() => {
                                props.onDeleteAction(item);
                              }}
                              danger
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
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

export function AdminUsersListScreen(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    activeTab,
    setActiveTab,
    tabs,
    loading,
    refreshing,
    error,
    hasData,
    hasStaleData,
    refresh,
    retry,
    setSearchTerm,
    setActivityFilter,
    setPage,
    setPageSize,
    pageSizeOptions,
  } = useAdminUsersTabsView({
    autoLoad: true,
  });
  const {
    pending: statusPending,
    error: statusError,
    updateStatus,
  } = useUpdateAdminUserStatus();
  const {
    destructivePending,
    error: deleteError,
    deleteUser,
  } = useDeleteAdminUser();
  const [detailUserId, setDetailUserId] = React.useState<string | null>(null);
  const [editUserId, setEditUserId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [statusTargetUser, setStatusTargetUser] =
    React.useState<AdminManagedUser | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] =
    React.useState<AdminManagedUser | null>(null);
  const urlTab = React.useMemo<RoleTabId | null>(() => {
    const candidate = searchParams.get("tab");

    if (
      candidate === "admin" ||
      candidate === "librarian" ||
      candidate === "student"
    ) {
      return candidate;
    }

    return null;
  }, [searchParams]);
  const resolvedActiveTab = urlTab ?? activeTab;

  const syncTabToUrl = React.useCallback(
    (nextTab: RoleTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      const currentUrlTab = params.get("tab");

      if (nextTab === "admin") {
        if (currentUrlTab === null) {
          return;
        }

        params.delete("tab");
      } else {
        if (currentUrlTab === nextTab) {
          return;
        }

        params.set("tab", nextTab);
      }

      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const handleTabChange = React.useCallback(
    (value: string) => {
      if (value === "admin" || value === "librarian" || value === "student") {
        setActiveTab(value);
        syncTabToUrl(value);
      }
    },
    [setActiveTab, syncTabToUrl],
  );

  const openDetailDialog = React.useCallback((userId: string) => {
    setDetailUserId(userId);
    setDetailOpen(true);
  }, []);

  const openEditDialog = React.useCallback((userId: string) => {
    setEditUserId(userId);
    setEditOpen(true);
  }, []);

  const handleConfirmStatusChange = React.useCallback(async () => {
    if (!statusTargetUser) {
      return;
    }

    const success = await updateStatus(
      statusTargetUser.user_id,
      !statusTargetUser.is_active,
    );

    if (success) {
      setStatusTargetUser(null);
    }
  }, [statusTargetUser, updateStatus]);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteTargetUser) {
      return;
    }

    const success = await deleteUser(deleteTargetUser.user_id);

    if (!success) {
      return;
    }

    if (detailUserId === deleteTargetUser.user_id) {
      setDetailOpen(false);
      setDetailUserId(null);
    }

    if (editUserId === deleteTargetUser.user_id) {
      setEditOpen(false);
      setEditUserId(null);
    }

    setDeleteTargetUser(null);
  }, [deleteTargetUser, deleteUser, detailUserId, editUserId]);

  return (
    <PageContainer
      eyebrow="Admin Users"
      title="User Management"
      description="Manage admin, librarian, and student accounts with fine-grained controls over status and access."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void refresh();
            }}
            disabled={loading || refreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshing ? "animate-spin" : "")}
            />
            Refresh
          </Button>
          <Button
            type="button"
            className="gap-2 rounded-xl"
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      }
    >
      <ScrollReveal direction="up" delayMs={90}>
        <div className="flex flex-1 flex-col gap-6">
          {error && !hasData ? (
            <AdminUsersListFailureState
              hasStaleData={false}
              message={error}
              onRetry={retry}
            />
          ) : null}

          {loading && !hasData ? (
            <AdminUsersListLoadingState />
          ) : (
            <>
              {error && hasData ? (
                <AdminUsersListFailureState
                  hasStaleData={hasStaleData}
                  message={error}
                  onRetry={retry}
                />
              ) : null}

              {statusError ? (
                <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                  {statusError}
                </div>
              ) : null}

              {deleteError ? (
                <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                  {deleteError}
                </div>
              ) : null}

              <Tabs
                value={resolvedActiveTab}
                onValueChange={handleTabChange}
                className="flex-1 gap-4"
              >
                <div className="-mx-1 overflow-x-auto px-1 pb-1 md:mx-0 md:overflow-visible md:px-0 md:pb-0">
                  <TabsList className="flex h-auto w-max min-w-full flex-nowrap rounded-[1.25rem] bg-muted/60 p-1.5 md:w-fit md:min-w-0 md:flex-wrap">
                    {tabs.map((tab) => (
                      <TabsTrigger
                        key={tab.role}
                        value={tab.role}
                        className="shrink-0 rounded-[0.9rem] px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground md:shrink"
                      >
                        {tab.label}
                        <Badge
                          variant="secondary"
                          className="ml-1 rounded-full bg-background/80"
                        >
                          {tab.totalItems}
                        </Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {tabs.map((tab) => (
                  <TabsContent key={tab.role} value={tab.role} className="mt-0">
                    <AdminUsersTabTable
                      role={tab.role}
                      loading={loading && !hasData}
                      refreshing={refreshing}
                      searchTerm={tab.controls.searchTerm}
                      activity={tab.controls.activity}
                      hasAppliedFilters={tab.hasAppliedFilters}
                      serverTotalItems={tab.serverTotalItems}
                      totalItems={tab.totalItems}
                      totalPages={tab.totalPages}
                      page={tab.controls.page}
                      pageSize={tab.controls.pageSize}
                      pageSizeOptions={pageSizeOptions}
                      pagedItems={tab.pagedItems}
                      onSearchChange={(value) => {
                        setSearchTerm(tab.role, value);
                      }}
                      onActivityChange={(value) => {
                        setActivityFilter(tab.role, value);
                      }}
                      onPageChange={(page) => {
                        setPage(tab.role, page);
                      }}
                      onPageSizeChange={(pageSize) => {
                        setPageSize(tab.role, pageSize);
                      }}
                      onView={openDetailDialog}
                      onEdit={openEditDialog}
                      onStatusAction={(user) => {
                        setStatusTargetUser(user);
                      }}
                      onDeleteAction={(user) => {
                        setDeleteTargetUser(user);
                      }}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </div>
      </ScrollReveal>

      <AdminUserCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={({ userId, role }) => {
          setCreateOpen(false);
          setActiveTab(role);
          syncTabToUrl(role);
          setDetailUserId(userId);
          setDetailOpen(true);
        }}
      />

      <AdminUserDetailDialog
        userId={detailUserId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);

          if (!open) {
            setDetailUserId(null);
          }
        }}
        onEditRequested={() => {
          if (detailUserId) {
            setDetailOpen(false);
            openEditDialog(detailUserId);
          }
        }}
      />

      <AdminUserEditDialog
        userId={editUserId}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);

          if (!open) {
            setEditUserId(null);
          }
        }}
      />

      <AlertDialog
        open={statusTargetUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setStatusTargetUser(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTargetUser?.is_active
                ? "Deactivate user?"
                : "Reactivate user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTargetUser?.is_active
                ? "The record stays in the system, but the account becomes unusable until it is reactivated."
                : "This will make the account usable again without recreating the user."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {statusError ? (
            <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
              {statusError}
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              disabled={statusPending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmStatusChange();
              }}
            >
              {statusPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTargetUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTargetUser(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the account flow itself. Deactivation is different
              and keeps the record usable for later restoration.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError ? (
            <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
              {deleteError}
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={destructivePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-danger text-white hover:bg-danger/90"
              disabled={destructivePending}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {destructivePending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
