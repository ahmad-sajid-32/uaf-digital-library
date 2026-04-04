// apps/web/src/components/admin-users/admin-user-edit-dialog.tsx
/**
 * Role-aware admin user edit dialog.
 *
 * Purpose:
 * - Edit only the fields allowed by the backend contract for each role.
 * - Keep destructive account actions outside this dialog so the table remains
 *   the single row-level command surface for deactivate and delete behavior.
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

import {
  AdminUserRoleBadge,
  AdminUserStatusBadge,
} from "@/components/admin-users";
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
  useAdminUserDetail,
  useUpdateAdminUserProfile,
} from "@/hooks/useAdmin";
import type {
  AdminManagedUserDetail,
  UpdateAdminManagedUserProfilePayload,
} from "@/lib/api/admin";

interface AdminUserEditDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditFormState {
  full_name: string;
  roll_number: string;
  department: string;
  semester: string;
  employee_code: string;
  designation: string;
}

function toEditFormState(user: AdminManagedUserDetail): EditFormState {
  if (user.role === "STUDENT") {
    return {
      full_name: user.full_name,
      roll_number: user.student_profile.roll_number,
      department: user.student_profile.department,
      semester: String(user.student_profile.semester),
      employee_code: "",
      designation: "",
    };
  }

  if (user.role === "LIBRARIAN") {
    return {
      full_name: user.full_name,
      roll_number: "",
      department: user.librarian_profile.department,
      semester: "",
      employee_code: user.librarian_profile.employee_code,
      designation: "",
    };
  }

  return {
    full_name: user.full_name,
    roll_number: "",
    department: "",
    semester: "",
    employee_code: "",
    designation: user.admin_profile.designation,
  };
}

function toProfilePayload(
  user: AdminManagedUserDetail,
  form: EditFormState,
): UpdateAdminManagedUserProfilePayload {
  if (user.role === "STUDENT") {
    return {
      full_name: form.full_name.trim(),
      roll_number: form.roll_number.trim(),
      department: form.department.trim(),
      semester: Number(form.semester),
    };
  }

  if (user.role === "LIBRARIAN") {
    return {
      full_name: form.full_name.trim(),
      employee_code: form.employee_code.trim(),
      department: form.department.trim(),
    };
  }

  return {
    full_name: form.full_name.trim(),
    designation: form.designation.trim(),
  };
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
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}

function RoleAwareFields(props: {
  user: AdminManagedUserDetail;
  form: EditFormState;
  pending: boolean;
  onChange: (patch: Partial<EditFormState>) => void;
}): React.JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="edit-full-name">Full Name</Label>
        <Input
          id="edit-full-name"
          value={props.form.full_name}
          onChange={(event) => {
            props.onChange({
              full_name: event.target.value,
            });
          }}
          disabled={props.pending}
          className="mt-2 rounded-xl"
        />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="edit-email">Email</Label>
        <Input
          id="edit-email"
          value={props.user.email}
          readOnly
          disabled
          className="mt-2 rounded-xl"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Email stays read-only because identity changes are not part of this
          contract.
        </p>
      </div>

      {props.user.role === "STUDENT" ? (
        <>
          <div className="sm:col-span-2">
            <Label htmlFor="edit-roll-number">AG Number</Label>
            <Input
              id="edit-roll-number"
              value={props.form.roll_number}
              onChange={(event) => {
                props.onChange({
                  roll_number: event.target.value,
                });
              }}
              disabled={props.pending}
              className="mt-2 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="edit-department">Department</Label>
            <Input
              id="edit-department"
              value={props.form.department}
              onChange={(event) => {
                props.onChange({
                  department: event.target.value,
                });
              }}
              disabled={props.pending}
              className="mt-2 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="edit-semester">Semester</Label>
            <Input
              id="edit-semester"
              type="number"
              min={1}
              value={props.form.semester}
              onChange={(event) => {
                props.onChange({
                  semester: event.target.value,
                });
              }}
              disabled={props.pending}
              className="mt-2 rounded-xl"
            />
          </div>
        </>
      ) : null}

      {props.user.role === "LIBRARIAN" ? (
        <>
          <div>
            <Label htmlFor="edit-employee-code">Employee Code</Label>
            <Input
              id="edit-employee-code"
              value={props.form.employee_code}
              onChange={(event) => {
                props.onChange({
                  employee_code: event.target.value,
                });
              }}
              disabled={props.pending}
              className="mt-2 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="edit-department">Department</Label>
            <Input
              id="edit-department"
              value={props.form.department}
              onChange={(event) => {
                props.onChange({
                  department: event.target.value,
                });
              }}
              disabled={props.pending}
              className="mt-2 rounded-xl"
            />
          </div>
        </>
      ) : null}

      {props.user.role === "ADMIN" ? (
        <div className="sm:col-span-2">
          <Label htmlFor="edit-designation">Designation</Label>
          <Input
            id="edit-designation"
            value={props.form.designation}
            onChange={(event) => {
              props.onChange({
                designation: event.target.value,
              });
            }}
            disabled={props.pending}
            className="mt-2 rounded-xl"
          />
        </div>
      ) : null}
    </div>
  );
}

export function AdminUserEditDialog({
  userId,
  open,
  onOpenChange,
}: AdminUserEditDialogProps): React.JSX.Element {
  const { user, loading, error, errorStatus, hasData, refreshing, retry } =
    useAdminUserDetail(userId, {
      autoLoad: open,
    });
  const {
    pending: profilePending,
    error: profileError,
    updateProfile,
  } = useUpdateAdminUserProfile();
  const [form, setForm] = React.useState<EditFormState>({
    full_name: "",
    roll_number: "",
    department: "",
    semester: "",
    employee_code: "",
    designation: "",
  });

  React.useEffect(() => {
    if (!user || !open) {
      return;
    }

    setForm(toEditFormState(user));
  }, [user, open]);

  const initialFormState = React.useMemo(
    () => (user ? toEditFormState(user) : null),
    [user],
  );
  const hasUnsavedChanges = React.useMemo(() => {
    if (!initialFormState) {
      return false;
    }

    return (
      form.full_name !== initialFormState.full_name ||
      form.roll_number !== initialFormState.roll_number ||
      form.department !== initialFormState.department ||
      form.semester !== initialFormState.semester ||
      form.employee_code !== initialFormState.employee_code ||
      form.designation !== initialFormState.designation
    );
  }, [form, initialFormState]);
  const anyPending = profilePending;

  const handleSave = React.useCallback(async () => {
    if (!user || !hasUnsavedChanges) {
      return;
    }

    const success = await updateProfile(
      user.user_id,
      toProfilePayload(user, form),
    );

    if (success) {
      onOpenChange(false);
    }
  }, [form, hasUnsavedChanges, onOpenChange, updateProfile, user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto rounded-[1.75rem] border-border/70 p-0">
        <div className="px-6 pb-6 pt-6">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-display text-2xl font-black tracking-tight">
              Edit User
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Update the details of this user. Fields that are not editable
              based on the user's role.
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-5" />

          {loading && !hasData ? <EditLoadingState /> : null}

          {!loading && !hasData && errorStatus === 404 ? (
            <EditStateCard
              icon={CircleOff}
              eyebrow="Not Found"
              title="This user record is no longer available."
              message={error ?? "The requested user could not be found."}
              onRetry={retry}
            />
          ) : null}

          {!loading && !hasData && errorStatus === 403 ? (
            <EditStateCard
              icon={Lock}
              eyebrow="Permission Denied"
              title="This user cannot be edited."
              message={
                error ?? "Your current account cannot update this record."
              }
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

          {user ? (
            <div className="space-y-4">
              <Card className="border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_48%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))] py-0 shadow-none">
                <CardContent className="px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <p className="font-display text-2xl font-black tracking-tight text-foreground">
                        {user.full_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
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
                    <div className="text-sm text-muted-foreground">
                      Created {new Date(user.created_at).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {profileError ? (
                <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                  {profileError}
                </div>
              ) : null}

              <Card className="border-border/60 bg-card/95 py-0 shadow-none">
                <CardContent className="px-5 py-5">
                  <RoleAwareFields
                    user={user}
                    form={form}
                    pending={anyPending}
                    onChange={(patch) => {
                      setForm((current) => ({
                        ...current,
                        ...patch,
                      }));
                    }}
                  />
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
              disabled={!user || anyPending || !hasUnsavedChanges}
              onClick={() => {
                void handleSave();
              }}
            >
              {profilePending ? (
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
