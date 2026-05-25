"use client";

import * as React from "react";
import {
  ImageUp,
  LoaderCircle,
  Pencil,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { SelfAvatarImage } from "@/components/self-profile/self-avatar-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SELF_AVATAR_MAX_FILE_SIZE_BYTES,
  isAllowedSelfAvatarMimeType,
  type SelfAvatarItem,
} from "@/lib/self-profile";
import { cn } from "@/lib/utils";

const CROP_PREVIEW_SIZE = 280;
const CROP_OUTPUT_SIZE = 512;

interface SelfAvatarEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatar: SelfAvatarItem | null;
  fullName: string | null;
  email: string | null;
  uploadAction: {
    pending: boolean;
    error: string | null;
    clearError: () => void;
    submit: (file: File) => Promise<boolean>;
  };
  removeAction: {
    pending: boolean;
    error: string | null;
    clearError: () => void;
    submit: () => Promise<boolean>;
  };
}

interface NaturalImageSize {
  width: number;
  height: number;
}

function getRenderSize(
  naturalSize: NaturalImageSize,
  zoom: number,
): { width: number; height: number; scale: number } {
  const baseScale =
    CROP_PREVIEW_SIZE / Math.min(naturalSize.width, naturalSize.height);
  const scale = baseScale * zoom;

  return {
    width: naturalSize.width * scale,
    height: naturalSize.height * scale,
    scale,
  };
}

function clampOffset(value: number, renderedLength: number): number {
  const maxOffset = Math.max(0, (renderedLength - CROP_PREVIEW_SIZE) / 2);
  return Math.min(maxOffset, Math.max(-maxOffset, value));
}

function blobFromCanvas(
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/jpeg",
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

export function SelfAvatarEditorDialog({
  open,
  onOpenChange,
  avatar,
  fullName,
  email,
  uploadAction,
  removeAction,
}: SelfAvatarEditorDialogProps): React.JSX.Element {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const imageRef = React.useRef<HTMLImageElement | null>(null);
  const dragStartRef = React.useRef<{
    pointerX: number;
    pointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [naturalSize, setNaturalSize] = React.useState<NaturalImageSize | null>(
    null,
  );
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [dragging, setDragging] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const hasCurrentAvatar = Boolean(
    avatar?.avatar_image_path || avatar?.avatar_image_url,
  );
  const pending = uploadAction.pending || removeAction.pending;

  const resetEditor = React.useCallback(() => {
    setSourceUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });
    setNaturalSize(null);
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    setDragging(false);
    setLocalError(null);
    uploadAction.clearError();
    removeAction.clearError();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [removeAction, uploadAction]);

  React.useEffect(() => {
    if (!open) {
      resetEditor();
    }
  }, [open, resetEditor]);

  React.useEffect(
    () => () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    },
    [sourceUrl],
  );

  const selectFile = React.useCallback(
    (file: File | null | undefined) => {
      if (!file) {
        return;
      }

      uploadAction.clearError();
      removeAction.clearError();
      setLocalError(null);

      if (!isAllowedSelfAvatarMimeType(file.type)) {
        setLocalError("Choose a JPEG, PNG, or WEBP image.");
        return;
      }

      if (file.size === 0) {
        setLocalError("Choose a non-empty image file.");
        return;
      }

      const nextUrl = URL.createObjectURL(file);
      setSourceUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return nextUrl;
      });
      setNaturalSize(null);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    },
    [removeAction, uploadAction],
  );

  const renderedSize = React.useMemo(() => {
    if (!naturalSize) {
      return null;
    }

    return getRenderSize(naturalSize, zoom);
  }, [naturalSize, zoom]);

  React.useEffect(() => {
    if (!renderedSize) {
      return;
    }

    setOffset((current) => ({
      x: clampOffset(current.x, renderedSize.width),
      y: clampOffset(current.y, renderedSize.height),
    }));
  }, [renderedSize]);

  const saveCroppedImage = React.useCallback(async () => {
    if (!imageRef.current || !naturalSize || !renderedSize) {
      setLocalError("Choose an image before saving.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = CROP_OUTPUT_SIZE;
    canvas.height = CROP_OUTPUT_SIZE;
    const context = canvas.getContext("2d");

    if (!context) {
      setLocalError("Unable to prepare the cropped image.");
      return;
    }

    const sourceX = Math.max(
      0,
      (renderedSize.width / 2 - offset.x - CROP_PREVIEW_SIZE / 2)
        / renderedSize.scale,
    );
    const sourceY = Math.max(
      0,
      (renderedSize.height / 2 - offset.y - CROP_PREVIEW_SIZE / 2)
        / renderedSize.scale,
    );
    const sourceSize = Math.min(
      CROP_PREVIEW_SIZE / renderedSize.scale,
      naturalSize.width - sourceX,
      naturalSize.height - sourceY,
    );

    context.drawImage(
      imageRef.current,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      CROP_OUTPUT_SIZE,
      CROP_OUTPUT_SIZE,
    );

    const webpBlob = await blobFromCanvas(canvas, "image/webp", 0.9);
    const blob = webpBlob ?? (await blobFromCanvas(canvas, "image/jpeg", 0.9));

    if (!blob) {
      setLocalError("Unable to export the cropped image.");
      return;
    }

    if (blob.size > SELF_AVATAR_MAX_FILE_SIZE_BYTES) {
      setLocalError("The cropped image must be under 2 MB.");
      return;
    }

    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const file = new File([blob], `avatar.${extension}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
    const uploaded = await uploadAction.submit(file);

    if (uploaded) {
      onOpenChange(false);
    }
  }, [
    naturalSize,
    offset.x,
    offset.y,
    onOpenChange,
    renderedSize,
    uploadAction,
  ]);

  const removeCurrentAvatar = React.useCallback(async () => {
    const removed = await removeAction.submit();

    if (removed) {
      onOpenChange(false);
    }
  }, [onOpenChange, removeAction]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border-border/70 bg-card p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle className="font-display text-2xl font-black tracking-tight">
            Profile Image
          </DialogTitle>
          <DialogDescription>
            Crop a square image for your profile and topbar avatar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 px-6 py-5 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-3">
            <SelfAvatarImage
              imageUrl={avatar?.avatar_image_url}
              fullName={fullName}
              email={email}
              size="xl"
            />
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending}
            >
              <ImageUp className="h-4 w-4" />
              Choose Image
            </Button>
          </div>

          <div className="grid gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                selectFile(event.target.files?.[0]);
              }}
            />

            <div
              className={cn(
                "flex min-h-80 items-center justify-center rounded-3xl border border-dashed border-border/70 bg-background/70 p-4",
                "transition-colors",
                sourceUrl
                  ? "border-solid"
                  : "hover:border-primary/40 hover:bg-primary/5",
              )}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                selectFile(event.dataTransfer.files[0]);
              }}
            >
              {sourceUrl && renderedSize ? (
                <div
                  className="relative touch-none overflow-hidden rounded-full border border-primary/25 bg-muted shadow-inner"
                  style={{
                    width: CROP_PREVIEW_SIZE,
                    height: CROP_PREVIEW_SIZE,
                  }}
                  onPointerDown={(event) => {
                    if (pending) {
                      return;
                    }

                    event.currentTarget.setPointerCapture(event.pointerId);
                    dragStartRef.current = {
                      pointerX: event.clientX,
                      pointerY: event.clientY,
                      offsetX: offset.x,
                      offsetY: offset.y,
                    };
                    setDragging(true);
                  }}
                  onPointerMove={(event) => {
                    if (!dragStartRef.current || !renderedSize) {
                      return;
                    }

                    const nextX =
                      dragStartRef.current.offsetX
                      + event.clientX
                      - dragStartRef.current.pointerX;
                    const nextY =
                      dragStartRef.current.offsetY
                      + event.clientY
                      - dragStartRef.current.pointerY;

                    setOffset({
                      x: clampOffset(nextX, renderedSize.width),
                      y: clampOffset(nextY, renderedSize.height),
                    });
                  }}
                  onPointerUp={() => {
                    dragStartRef.current = null;
                    setDragging(false);
                  }}
                  onPointerCancel={() => {
                    dragStartRef.current = null;
                    setDragging(false);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imageRef}
                    src={sourceUrl}
                    alt=""
                    draggable={false}
                    className={cn(
                      "absolute left-1/2 top-1/2 max-w-none select-none object-cover",
                      dragging ? "cursor-grabbing" : "cursor-grab",
                    )}
                    style={{
                      width: renderedSize.width,
                      height: renderedSize.height,
                      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                    }}
                    onLoad={(event) => {
                      setNaturalSize({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      });
                    }}
                  />
                </div>
              ) : sourceUrl ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sourceUrl}
                    alt=""
                    className="sr-only"
                    onLoad={(event) => {
                      setNaturalSize({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      });
                    }}
                  />
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading image
                </div>
              ) : (
                <div className="max-w-sm text-center">
                  <UploadCloud className="mx-auto h-10 w-10 text-primary" />
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    Drop a JPEG, PNG, or WEBP image here
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    The saved crop is exported as a square image before upload.
                  </p>
                </div>
              )}
            </div>

            <label className="grid gap-2 text-sm font-medium text-foreground">
              Zoom
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                disabled={!sourceUrl || pending}
                onChange={(event) => {
                  setZoom(Number(event.target.value));
                }}
                className="accent-primary"
              />
            </label>

            {localError || uploadAction.error || removeAction.error ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {localError || uploadAction.error || removeAction.error}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-5">
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={!hasCurrentAvatar || pending}
            onClick={() => {
              void removeCurrentAvatar();
            }}
          >
            {removeAction.pending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Remove Image
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-2 rounded-xl"
            disabled={!sourceUrl || !naturalSize || pending}
            onClick={() => {
              void saveCroppedImage();
            }}
          >
            {uploadAction.pending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
            Save Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
