// apps/web/src/components/admin-users/admin-user-create-dialog.tsx
/**
 * Admin user creation dialog for all supported roles.
 *
 * Purpose:
 * - Provide one shell-native create flow for student, librarian, and admin
 *   accounts.
 * - Keep role-specific field requirements aligned with the backend create
 *   contracts instead of inventing a unified fake form.
 */

"use client";

import * as React from "react";
import { LoaderCircle, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateAdminManagedUser } from "@/hooks/useAdmin";
import type { AppRole } from "@/lib/auth/types";

type CreateRole = AppRole;

interface AdminUserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (params: { userId: string; role: CreateRole }) => void;
}

interface CreateFormState {
  email: string;
  full_name: string;
  roll_number: string;
  department: string;
  semester: string;
  employee_code: string;
  designation: string;
}

const DEFAULT_CREATE_FORM: CreateFormState = {
  email: "",
  full_name: "",
  roll_number: "",
  department: "",
  semester: "",
  employee_code: "",
  designation: "",
};

const ROLE_COPY: Record<
  CreateRole,
  {
    title: string;
    summary: string;
  }
> = {
  student: {
    title: "Create Student",
    summary:
      "Student accounts create individual library profiles. Roll number, department, and semester information help in categorizing students.",
  },
  librarian: {
    title: "Create Librarian",
    summary:
      "Librarian accounts are designed to manage library operations. Employee code and department information help in assigning appropriate permissions ",
  },
  admin: {
    title: "Create Admin",
    summary:
      "Admin accounts have elevated privileges for managing the library system. Designation information helps in understanding the admin's role within the institution.",
  },
};

function getValidationMessage(
  role: CreateRole,
  form: CreateFormState,
): string | null {
  if (!form.email.trim()) {
    return "Email is required.";
  }

  if (!form.full_name.trim()) {
    return "Full name is required.";
  }

  if (role === "student") {
    if (!form.roll_number.trim()) {
      return "Roll number is required for students.";
    }

    if (!form.department.trim()) {
      return "Department is required for students.";
    }

    if (!form.semester.trim()) {
      return "Semester is required for students.";
    }

    const semester = Number(form.semester);

    if (!Number.isInteger(semester) || semester < 1) {
      return "Semester must be a whole number greater than zero.";
    }
  }

  if (role === "librarian") {
    if (!form.employee_code.trim()) {
      return "Employee code is required for librarians.";
    }

    if (!form.department.trim()) {
      return "Department is required for librarians.";
    }
  }

  if (role === "admin" && !form.designation.trim()) {
    return "Designation is required for admins.";
  }

  return null;
}

function RoleAwareCreateFields(props: {
  role: CreateRole;
  form: CreateFormState;
  pending: boolean;
  validationError: string | null;
  requestError: string | null;
  onChange: (patch: Partial<CreateFormState>) => void;
}): React.JSX.Element {
  const copy = ROLE_COPY[props.role];

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_48%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)))] py-0 shadow-none">
        <CardHeader className="px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="font-display text-2xl font-black tracking-tight">
                {copy.title}
              </CardTitle>
              <CardDescription className="px-0 text-sm leading-6">
                {copy.summary}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/5 text-primary"
            >
              {props.role}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {props.validationError ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {props.validationError}
        </div>
      ) : null}

      {props.requestError ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {props.requestError}
        </div>
      ) : null}

      <Card className="border-border/60 bg-card/95 py-0 shadow-none">
        <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor={`create-${props.role}-full-name`}>Full Name</Label>
            <Input
              id={`create-${props.role}-full-name`}
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
            <Label htmlFor={`create-${props.role}-email`}>Email</Label>
            <Input
              id={`create-${props.role}-email`}
              type="email"
              value={props.form.email}
              onChange={(event) => {
                props.onChange({
                  email: event.target.value,
                });
              }}
              disabled={props.pending}
              className="mt-2 rounded-xl"
            />
          </div>

          {props.role === "student" ? (
            <>
              <div className="sm:col-span-2">
                <Label htmlFor="create-student-roll-number">AG Number</Label>
                <Input
                  id="create-student-roll-number"
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
                <Label htmlFor="create-student-department">Department</Label>
                <Input
                  id="create-student-department"
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
                <Label htmlFor="create-student-semester">Semester</Label>
                <Input
                  id="create-student-semester"
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

          {props.role === "librarian" ? (
            <>
              <div>
                <Label htmlFor="create-librarian-employee-code">
                  Employee Code
                </Label>
                <Input
                  id="create-librarian-employee-code"
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
                <Label htmlFor="create-librarian-department">Department</Label>
                <Input
                  id="create-librarian-department"
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

          {props.role === "admin" ? (
            <div className="sm:col-span-2">
              <Label htmlFor="create-admin-designation">Designation</Label>
              <Input
                id="create-admin-designation"
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
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminUserCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: AdminUserCreateDialogProps): React.JSX.Element {
  const { pending, error, createUser } = useCreateAdminManagedUser();
  const [activeRole, setActiveRole] = React.useState<CreateRole>("student");
  const [forms, setForms] = React.useState<Record<CreateRole, CreateFormState>>(
    {
      student: { ...DEFAULT_CREATE_FORM },
      librarian: { ...DEFAULT_CREATE_FORM },
      admin: { ...DEFAULT_CREATE_FORM },
    },
  );
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (open) {
      return;
    }

    setValidationError(null);
  }, [open]);

  const currentForm = forms[activeRole];

  const updateForm = React.useCallback(
    (role: CreateRole, patch: Partial<CreateFormState>) => {
      setForms((current) => ({
        ...current,
        [role]: {
          ...current[role],
          ...patch,
        },
      }));
    },
    [],
  );

  const handleSubmit = React.useCallback(async () => {
    const message = getValidationMessage(activeRole, currentForm);

    if (message) {
      setValidationError(message);
      return;
    }

    setValidationError(null);

    const created =
      activeRole === "student"
        ? await createUser({
            role: "student",
            payload: {
              email: currentForm.email.trim(),
              full_name: currentForm.full_name.trim(),
              roll_number: currentForm.roll_number.trim(),
              department: currentForm.department.trim(),
              semester: Number(currentForm.semester),
            },
          })
        : activeRole === "librarian"
          ? await createUser({
              role: "librarian",
              payload: {
                email: currentForm.email.trim(),
                full_name: currentForm.full_name.trim(),
                employee_code: currentForm.employee_code.trim(),
                department: currentForm.department.trim(),
              },
            })
          : await createUser({
              role: "admin",
              payload: {
                email: currentForm.email.trim(),
                full_name: currentForm.full_name.trim(),
                designation: currentForm.designation.trim(),
              },
            });

    if (!created) {
      return;
    }

    setForms({
      student: { ...DEFAULT_CREATE_FORM },
      librarian: { ...DEFAULT_CREATE_FORM },
      admin: { ...DEFAULT_CREATE_FORM },
    });
    onOpenChange(false);
    onCreated({
      userId: created.user_id,
      role: activeRole,
    });
  }, [activeRole, createUser, currentForm, onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto rounded-[1.75rem] border-border/70 p-0">
        <div className="px-6 pb-6 pt-6">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="font-display text-2xl font-black tracking-tight">
              Create User
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Create student, librarian, and admin accounts. Select the
              appropriate role tab to fill in the required information and
              create the account.
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-5" />

          <Tabs
            value={activeRole}
            onValueChange={(value) => {
              if (
                value === "student" ||
                value === "librarian" ||
                value === "admin"
              ) {
                setActiveRole(value);
                setValidationError(null);
              }
            }}
            className="gap-4"
          >
            <TabsList className="h-auto w-fit flex-wrap rounded-[1.25rem] bg-muted/60 p-1.5">
              <TabsTrigger
                value="student"
                className="rounded-[0.9rem] px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-background"
              >
                Student
              </TabsTrigger>
              <TabsTrigger
                value="librarian"
                className="rounded-[0.9rem] px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-background"
              >
                Librarian
              </TabsTrigger>
              <TabsTrigger
                value="admin"
                className="rounded-[0.9rem] px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-background"
              >
                Admin
              </TabsTrigger>
            </TabsList>

            {(["student", "librarian", "admin"] as const).map((role) => (
              <TabsContent key={role} value={role} className="mt-0">
                <RoleAwareCreateFields
                  role={role}
                  form={forms[role]}
                  pending={pending}
                  validationError={role === activeRole ? validationError : null}
                  requestError={role === activeRole ? error : null}
                  onChange={(patch) => {
                    updateForm(role, patch);
                  }}
                />
              </TabsContent>
            ))}
          </Tabs>

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
                <Plus className="h-4 w-4" />
              )}
              Create {activeRole.charAt(0).toUpperCase() + activeRole.slice(1)}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
