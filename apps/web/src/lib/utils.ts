// apps/web/src/lib/utils.ts
/**
 * Shared utility helpers for UI class composition.
 *
 * This module exposes a single `cn` helper so UI primitives can merge
 * conditional Tailwind class names without duplicating utility logic.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
