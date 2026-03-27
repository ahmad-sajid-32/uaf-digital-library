// apps/web/src/components/admin-users/admin-user-detail-dialog.tsx
/**
 * Read-only admin user detail dialog.
 *
 * Purpose:
 * - Render the role-explicit admin user detail contract inside a dialog.
 * - Provide truthful loading, retry, not-found, and permission-denied states
 *   before mutation dialogs are opened.
 */

"use client";

import * as React from "react";
import {
  AlertCircle,
  CircleOff,
  Lock,
  Mail,
  RefreshCw,
  ShieldUser,
  UserRound,
} from "lucide-react";

import {
  AdminUserRoleBadge,
  AdminUserStatusBadge,
} from "@/components/admin-users";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminUserDetail } from "@/hooks/useAdmin";
import type { AdminManagedUserDetail } from "@/lib/api/admin";

interface AdminUserDetailDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditRequested: () => void;
}

function DetailStateCard(props: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
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
        {props.actionLabel && props.onAction ? (
          <Button
            type="button"
            variant="outline"
            className="mt-5 gap-2 rounded-xl"
            onClick={() => {
              void props.onAction?.();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            {props.actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RoleSpecificDetailSection({
  user,
}: {
  user: AdminManagedUserDetail;
}): React.JSX.Element {
  if (user.role === "STUDENT") {
    return (
      <Card className="border-border/60 bg-card/95 py-0 shadow-none">
        <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              AG Number
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {user.student_profile.roll_number}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Department
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {user.student_profile.department}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Semester
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {user.student_profile.semester}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (user.role === "LIBRARIAN") {
    return (
      <Card className="border-border/60 bg-card/95 py-0 shadow-none">
        <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Employee Code
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {user.librarian_profile.employee_code}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Department
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {user.librarian_profile.department}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/95 py-0 shadow-none">
      <CardContent className="px-5 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Designation
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {user.admin_profile.designation}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function UserDetailContent({
  user,
  refreshing,
}: {
  user: AdminManagedUserDetail;
  refreshing: boolean;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_48%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))] py-0 shadow-none">
        <CardContent className="px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-2xl font-black tracking-tight text-foreground">
                    {user.full_name}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AdminUserRoleBadge role={user.role} />
                    <AdminUserStatusBadge isActive={user.is_active} />
                    {refreshing ? (
                      <Badge
                        variant="secondary"
                        className="gap-1.5 rounded-full"
                      >
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Refreshing
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {user.email}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <RoleSpecificDetailSection user={user} />
    </div>
  );
}

function DetailLoadingState(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <Skeleton className="h-36 rounded-[1.75rem]" />
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  );
}

export function AdminUserDetailDialog({
  userId,
  open,
  onOpenChange,
  onEditRequested,
}: AdminUserDetailDialogProps): React.JSX.Element {
  const { user, loading, error, errorStatus, hasData, refreshing, retry } =
    useAdminUserDetail(userId, {
      autoLoad: open,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-[1.75rem] border-border/70 p-0">
        <div className="px-6 pb-6 pt-6">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-display text-2xl font-black tracking-tight">
              User Detail
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              View detailed information about this user record. If you want to
              make any changes, click the "Edit User" button below to open the
              mutation dialog.
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-5" />

          {loading && !hasData ? <DetailLoadingState /> : null}

          {!loading && !hasData && errorStatus === 404 ? (
            <DetailStateCard
              icon={CircleOff}
              eyebrow="Not Found"
              title="This user record is no longer available."
              message={error ?? "The requested user could not be found."}
              actionLabel="Retry"
              onAction={retry}
            />
          ) : null}

          {!loading && !hasData && errorStatus === 403 ? (
            <DetailStateCard
              icon={Lock}
              eyebrow="Permission Denied"
              title="This user detail cannot be opened."
              message={
                error ?? "Your current account cannot access this record."
              }
              actionLabel="Retry"
              onAction={retry}
            />
          ) : null}

          {!loading &&
          !hasData &&
          errorStatus !== 403 &&
          errorStatus !== 404 &&
          error ? (
            <DetailStateCard
              icon={AlertCircle}
              eyebrow="Retry Required"
              title="Unable to load this user right now."
              message={error}
              actionLabel="Retry"
              onAction={retry}
            />
          ) : null}

          {user ? (
            <UserDetailContent user={user} refreshing={refreshing} />
          ) : null}

          <DialogFooter className="mt-6 border-t border-border/60 pt-5">
            <Button
              type="button"
              className="gap-2 rounded-xl"
              disabled={!user}
              onClick={() => {
                onEditRequested();
              }}
            >
              <ShieldUser className="h-4 w-4" />
              Edit User
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
