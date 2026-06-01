// apps/web/src/components/books/book-cover-image.tsx
/**
 * Reusable book-cover image component for staff and student book surfaces.
 *
 * Purpose:
 * - Render a consistent cover thumbnail/card across inventory, detail dialogs,
 *   create/edit previews, and student catalog views.
 * - Show a stable institutional fallback when a book has no uploaded cover.
 * - Handle broken remote image URLs without breaking the surrounding layout.
 *
 * Book Cover Integration:
 * - The backend returns `cover_image_url` as the public display URL.
 * - This component only displays that URL.
 * - Upload, delete, validation, and storage ownership remain outside this file.
 */

"use client";

import Image from "next/image";
import * as React from "react";
import { BookOpen, ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

export type BookCoverImageVariant = "thumbnail" | "compact" | "card" | "hero";

interface BookCoverImageProps {
  title: string;
  author?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  variant?: BookCoverImageVariant;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  showTextFallback?: boolean;
  loading?: "eager" | "lazy";
}

interface VariantStyle {
  frameClassName: string;
  iconClassName: string;
  textWrapperClassName: string;
  titleClassName: string;
  descriptionClassName: string;
  imageSizes: string;
}

const VARIANT_STYLES: Record<BookCoverImageVariant, VariantStyle> = {
  thumbnail: {
    frameClassName: "h-14 w-11 rounded-xl",
    iconClassName: "h-4 w-4",
    textWrapperClassName: "hidden",
    titleClassName: "sr-only",
    descriptionClassName: "sr-only",
    imageSizes: "44px",
  },
  compact: {
    frameClassName: "h-20 w-14 rounded-2xl",
    iconClassName: "h-5 w-5",
    textWrapperClassName: "hidden",
    titleClassName: "sr-only",
    descriptionClassName: "sr-only",
    imageSizes: "56px",
  },
  card: {
    frameClassName: "aspect-[3/4] w-full rounded-3xl",
    iconClassName: "h-8 w-8",
    textWrapperClassName: "mt-4 min-w-0 px-4 text-center",
    titleClassName: "line-clamp-2 text-sm font-black leading-5 text-foreground",
    descriptionClassName:
      "mt-1 line-clamp-1 text-xs font-medium text-muted-foreground",
    imageSizes: "(max-width: 768px) 50vw, 25vw",
  },
  hero: {
    frameClassName: "aspect-[3/4] w-full rounded-[1.75rem]",
    iconClassName: "h-10 w-10",
    textWrapperClassName: "mt-5 min-w-0 px-5 text-center",
    titleClassName:
      "line-clamp-2 text-base font-black leading-6 text-foreground",
    descriptionClassName:
      "mt-1 line-clamp-1 text-sm font-medium text-muted-foreground",
    imageSizes: "(max-width: 768px) 70vw, 320px",
  },
};

function getFallbackTitle(title: string): string {
  const normalizedTitle = title.trim();

  if (normalizedTitle) {
    return normalizedTitle;
  }

  return "Untitled book";
}

function getFallbackDescription(author: string | null | undefined): string {
  const normalizedAuthor = author?.trim();

  if (normalizedAuthor) {
    return normalizedAuthor;
  }

  return "No cover image";
}

function getImageAltText(props: {
  coverImageAlt?: string | null;
  title: string;
}): string {
  const normalizedAlt = props.coverImageAlt?.trim();

  if (normalizedAlt) {
    return normalizedAlt;
  }

  return `Cover image for ${getFallbackTitle(props.title)}`;
}

export function BookCoverImage({
  title,
  author,
  coverImageUrl,
  coverImageAlt,
  variant = "thumbnail",
  className,
  imageClassName,
  fallbackClassName,
  showTextFallback,
  loading = "lazy",
}: BookCoverImageProps): React.JSX.Element {
  const [imageFailed, setImageFailed] = React.useState(false);
  const variantStyle = VARIANT_STYLES[variant];
  const normalizedImageUrl = coverImageUrl?.trim() ?? "";
  const hasRenderableImage = normalizedImageUrl.length > 0 && !imageFailed;
  const fallbackTitle = getFallbackTitle(title);
  const fallbackDescription = getFallbackDescription(author);
  const shouldShowTextFallback =
    showTextFallback ?? (variant === "card" || variant === "hero");

  React.useEffect(() => {
    setImageFailed(false);
  }, [normalizedImageUrl]);

  return (
    <div
      className={cn(
        "relative isolate flex shrink-0 overflow-hidden border border-border/60 bg-muted/40 shadow-sm",
        "before:absolute before:inset-0 before:-z-10 before:bg-gradient-to-br before:from-primary/10 before:via-background before:to-muted",
        variantStyle.frameClassName,
        className,
      )}
    >
      {hasRenderableImage ? (
        <Image
          src={normalizedImageUrl}
          alt={getImageAltText({ coverImageAlt, title })}
          fill
          sizes={variantStyle.imageSizes}
          loading={loading}
          decoding="async"
          draggable={false}
          unoptimized
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            imageClassName,
          )}
          onError={() => {
            setImageFailed(true);
          }}
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full flex-col items-center justify-center overflow-hidden text-primary",
            fallbackClassName,
          )}
          role="img"
          aria-label={`No cover image available for ${fallbackTitle}`}
        >
          <div className="flex items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 p-3">
            {normalizedImageUrl ? (
              <ImageOff className={variantStyle.iconClassName} />
            ) : (
              <BookOpen className={variantStyle.iconClassName} />
            )}
          </div>

          {shouldShowTextFallback ? (
            <div className={variantStyle.textWrapperClassName}>
              <p className={variantStyle.titleClassName}>{fallbackTitle}</p>
              <p className={variantStyle.descriptionClassName}>
                {fallbackDescription}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
