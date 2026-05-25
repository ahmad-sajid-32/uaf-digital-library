"use client";

import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type SelfAvatarImageSize = "sm" | "md" | "lg" | "xl";

const AVATAR_SIZE_CLASS: Record<SelfAvatarImageSize, string> = {
  sm: "size-10",
  md: "size-16",
  lg: "size-24",
  xl: "size-32",
};

const FALLBACK_TEXT_CLASS: Record<SelfAvatarImageSize, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-4xl",
};

function getInitials(fullName: string | null | undefined, email?: string): string {
  const source = fullName?.trim() || email?.trim() || "User";
  const parts = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "U";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

interface SelfAvatarImageProps {
  imageUrl?: string | null;
  fullName?: string | null;
  email?: string | null;
  size?: SelfAvatarImageSize;
  className?: string;
  fallbackClassName?: string;
  onImageError?: () => void;
}

export function SelfAvatarImage({
  imageUrl,
  fullName,
  email,
  size = "md",
  className,
  fallbackClassName,
  onImageError,
}: SelfAvatarImageProps): React.JSX.Element {
  const [failedImageUrl, setFailedImageUrl] = React.useState<string | null>(null);
  const normalizedImageUrl = imageUrl?.trim() || null;
  const canRenderImage =
    Boolean(normalizedImageUrl) && normalizedImageUrl !== failedImageUrl;

  React.useEffect(() => {
    if (normalizedImageUrl !== failedImageUrl) {
      setFailedImageUrl(null);
    }
  }, [failedImageUrl, normalizedImageUrl]);

  return (
    <Avatar
      className={cn(
        AVATAR_SIZE_CLASS[size],
        "border border-primary/15 bg-primary/10 shadow-sm",
        className,
      )}
    >
      {canRenderImage ? (
        <AvatarImage
          src={normalizedImageUrl ?? undefined}
          alt={fullName?.trim() ? `${fullName.trim()} profile image` : "Profile image"}
          className="object-cover"
          onLoadingStatusChange={(status) => {
            if (status === "error" && normalizedImageUrl) {
              setFailedImageUrl(normalizedImageUrl);
              onImageError?.();
            }
          }}
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "bg-primary/10 font-display font-black text-primary",
          FALLBACK_TEXT_CLASS[size],
          fallbackClassName,
        )}
      >
        {getInitials(fullName, email ?? undefined)}
      </AvatarFallback>
    </Avatar>
  );
}
