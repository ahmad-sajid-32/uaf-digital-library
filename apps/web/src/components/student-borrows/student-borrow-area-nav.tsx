"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

const BORROW_AREA_LINKS = [
  {
    href: "/student/borrows",
    label: "Active",
  },
  {
    href: "/student/borrows/history",
    label: "History",
  },
] as const;

export function StudentBorrowAreaNav() {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex flex-wrap gap-2">
      {BORROW_AREA_LINKS.map((item) => {
        const isCurrent =
          item.href === "/student/borrows"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Button
            key={item.href}
            asChild
            variant={isCurrent ? "default" : "outline"}
            className="rounded-full"
            aria-current={isCurrent ? "page" : undefined}
          >
            <Link href={item.href}>{item.label}</Link>
          </Button>
        );
      })}
    </div>
  );
}
