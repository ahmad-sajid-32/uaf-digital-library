"use client";

import * as React from "react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type ScrollRevealDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "up-left"
  | "up-right"
  | "down-left"
  | "down-right";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  direction?: ScrollRevealDirection;
  delayMs?: number;
  durationMs?: number;
  distancePx?: number;
  threshold?: number;
  once?: boolean;
}

const REVEAL_DIRECTION_PATTERN: ScrollRevealDirection[] = [
  "up",
  "right",
  "left",
  "up-right",
  "up-left",
  "down",
];

function getHiddenTransform(
  direction: ScrollRevealDirection,
  distancePx: number,
): string {
  switch (direction) {
    case "down":
      return `translate3d(0, -${distancePx}px, 0)`;
    case "left":
      return `translate3d(${distancePx}px, 0, 0)`;
    case "right":
      return `translate3d(-${distancePx}px, 0, 0)`;
    case "up-left":
      return `translate3d(${distancePx}px, ${distancePx}px, 0)`;
    case "up-right":
      return `translate3d(-${distancePx}px, ${distancePx}px, 0)`;
    case "down-left":
      return `translate3d(${distancePx}px, -${distancePx}px, 0)`;
    case "down-right":
      return `translate3d(-${distancePx}px, -${distancePx}px, 0)`;
    case "up":
    default:
      return `translate3d(0, ${distancePx}px, 0)`;
  }
}

export function getStaggeredRevealDirection(
  index: number,
): ScrollRevealDirection {
  return REVEAL_DIRECTION_PATTERN[index % REVEAL_DIRECTION_PATTERN.length];
}

export function getStaggeredRevealDelay(
  index: number,
  stepMs = 70,
  baseMs = 0,
): number {
  return baseMs + (index % 6) * stepMs;
}

export function ScrollReveal({
  children,
  className,
  direction = "up",
  delayMs = 0,
  durationMs = 720,
  distancePx = 24,
  threshold = 0.16,
  once = true,
}: ScrollRevealProps): React.JSX.Element {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setRevealed(true);

          if (once) {
            observer.disconnect();
          }

          return;
        }

        if (!once) {
          setRevealed(false);
        }
      },
      {
        threshold,
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [once, threshold]);

  const style: CSSProperties = {
    opacity: revealed ? 1 : 0,
    transform: revealed
      ? "translate3d(0, 0, 0)"
      : getHiddenTransform(direction, distancePx),
    filter: revealed ? "blur(0px)" : "blur(10px)",
    transitionProperty: "opacity, transform, filter",
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    transitionDelay: `${delayMs}ms`,
    willChange: "opacity, transform, filter",
  };

  return (
    <div ref={ref} className={cn("min-w-0", className)} style={style}>
      {children}
    </div>
  );
}
