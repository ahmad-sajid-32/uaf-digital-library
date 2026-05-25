"use client";

import * as React from "react";
import {
  AlertCircle,
  LoaderCircle,
  Pencil,
  RefreshCw,
  ShieldAlert,
  UserCircle2,
} from "lucide-react";

import { PageContainer } from "@/components/app-shell";
import { SelfAvatarEditorDialog } from "@/components/self-profile/self-avatar-editor-dialog";
import { SelfAvatarImage } from "@/components/self-profile/self-avatar-image";
import { SelfDeleteAccountDialog } from "@/components/self-profile/self-delete-account-dialog";
import { SelfProfileForm } from "@/components/self-profile/self-profile-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSelfAvatar } from "@/hooks/useSelfAvatar";
import { useSelfProfile } from "@/hooks/useSelfProfile";

function SelfProfileLoadingState() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-72 rounded-3xl" />
      <Skeleton className="h-52 rounded-3xl" />
    </div>
  );
}

function SelfProfileFailureState(props: {
  heading: string;
  message: string;
  onRetry: () => void | Promise<void>;
}) {
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
          <p className="text-lg font-black text-foreground">{props.heading}</p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.message}
          </p>
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

interface SelfProfileScreenProps {
  eyebrow: string;
  description: string;
  allowAccountDeletion?: boolean;
}

export function SelfProfileScreen({
  eyebrow,
  description,
  allowAccountDeletion = false,
}: SelfProfileScreenProps) {
  const profileState = useSelfProfile({
    allowAccountDeletion,
    deleteRedirectTo: allowAccountDeletion
      ? "/login?auth=account-deleted"
      : "/login",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = React.useState(false);
  const [deleteConfirmationValue, setDeleteConfirmationValue] =
    React.useState("");
  const avatarState = useSelfAvatar({ autoLoad: true });

  const refreshProfileSurface = React.useCallback(async () => {
    await Promise.allSettled([profileState.refresh(), avatarState.refresh()]);
  }, [avatarState, profileState]);

  const closeDeleteDialog = React.useCallback(
    (open: boolean) => {
      if (profileState.deleteAccount.pending) {
        return;
      }

      setDeleteDialogOpen(open);

      if (!open) {
        setDeleteConfirmationValue("");
        profileState.deleteAccount.clearError();
      }
    },
    [profileState.deleteAccount],
  );

  const profile = profileState.profile;

  return (
    <PageContainer
      eyebrow={eyebrow}
      title="Profile"
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            Protected
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Self service
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Avatar enabled
          </Badge>
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => {
              void refreshProfileSurface();
            }}
            disabled={
              profileState.loading ||
              profileState.refreshing ||
              avatarState.loading ||
              avatarState.refreshing
            }
          >
            {profileState.refreshing || avatarState.refreshing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col gap-6">
        {profileState.loading ? (
          <SelfProfileLoadingState />
        ) : profileState.unavailable || !profile ? (
          <SelfProfileFailureState
            heading="Unable to load your profile."
            message="Please sign in again and retry."
            onRetry={profileState.retry}
          />
        ) : (
          <>
            <Card className="rounded-3xl border-border/70 bg-card/95 py-0 shadow-none">
              <CardContent className="flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="relative w-max">
                    {avatarState.loading ? (
                      <Skeleton className="size-32 rounded-full" />
                    ) : (
                      <SelfAvatarImage
                        imageUrl={avatarState.avatar?.avatar_image_url}
                        fullName={profile.fullName}
                        email={profile.email}
                        size="xl"
                      />
                    )}
                    <Button
                      type="button"
                      size="icon"
                      className="absolute bottom-1 left-1 size-9 rounded-full border border-background/80 shadow-sm"
                      onClick={() => {
                        setAvatarDialogOpen(true);
                      }}
                      disabled={
                        avatarState.upload.pending || avatarState.remove.pending
                      }
                      aria-label="Edit profile image"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="rounded-full">
                        Profile image
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="font-display text-2xl font-black tracking-tight text-foreground">
                        {profile.fullName || profile.email}
                      </p>
                      <p className="text-sm font-medium text-muted-foreground">
                        {profile.email}
                      </p>
                    </div>
                    {avatarState.error ? (
                      <p className="max-w-xl text-sm leading-6 text-destructive">
                        {avatarState.error}
                      </p>
                    ) : (
                      <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                        Upload a profile image to personalize your account.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <SelfAvatarEditorDialog
              open={avatarDialogOpen}
              onOpenChange={setAvatarDialogOpen}
              avatar={avatarState.avatar}
              fullName={profile.fullName}
              email={profile.email}
              uploadAction={avatarState.upload}
              removeAction={avatarState.remove}
            />

            <SelfProfileForm
              email={profile.email}
              roleLabel={profile.roleLabel}
              fullName={profileState.fullName.value}
              userId={profile.userId}
              dirty={profileState.fullName.dirty}
              pending={profileState.fullName.pending}
              canSubmit={profileState.fullName.canSubmit}
              validationError={profileState.fullName.validationError}
              error={profileState.fullName.error}
              syncWarning={profileState.fullName.syncWarning}
              onFullNameChange={profileState.fullName.setValue}
              onSubmit={profileState.fullName.submit}
              onReset={profileState.fullName.reset}
            />

            {allowAccountDeletion ? (
              <>
                <Card className="rounded-3xl border-destructive/20 bg-destructive/5 py-0 shadow-none">
                  <CardContent className="flex flex-col gap-5 px-6 py-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-destructive">
                        <ShieldAlert className="h-5 w-5" />
                        <p className="text-sm font-semibold uppercase tracking-[0.18em]">
                          Account Deletion
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-black text-foreground">
                          Delete this account permanently
                        </p>
                        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                          This permanently deletes your account and related
                          library records.
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-2 rounded-xl lg:self-center"
                      disabled={profileState.deleteAccount.pending}
                      onClick={() => {
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <UserCircle2 className="h-4 w-4" />
                      Delete Account
                    </Button>
                  </CardContent>
                </Card>

                <SelfDeleteAccountDialog
                  open={deleteDialogOpen}
                  onOpenChange={closeDeleteDialog}
                  email={profile.email}
                  pending={profileState.deleteAccount.pending}
                  error={profileState.deleteAccount.error}
                  confirmationValue={deleteConfirmationValue}
                  onConfirmationValueChange={setDeleteConfirmationValue}
                  onConfirm={profileState.deleteAccount.submit}
                />
              </>
            ) : null}
          </>
        )}
      </div>
    </PageContainer>
  );
}
