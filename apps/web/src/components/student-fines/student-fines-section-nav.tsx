"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudentFineSection } from "@/lib/student-fines";

interface StudentFinesSectionNavProps {
  section: StudentFineSection;
  currentCount: number;
  historyCount: number;
  onSectionChange: (section: StudentFineSection) => void;
}

export function StudentFinesSectionNav({
  section,
  currentCount,
  historyCount,
  onSectionChange,
}: StudentFinesSectionNavProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant={section === "current" ? "default" : "outline"}
        className="rounded-full"
        onClick={() => {
          onSectionChange("current");
        }}
        aria-current={section === "current" ? "page" : undefined}
      >
        Current
        <Badge
          variant={section === "current" ? "secondary" : "outline"}
          className="ml-2 rounded-full"
        >
          {currentCount}
        </Badge>
      </Button>

      <Button
        type="button"
        variant={section === "history" ? "default" : "outline"}
        className="rounded-full"
        onClick={() => {
          onSectionChange("history");
        }}
        aria-current={section === "history" ? "page" : undefined}
      >
        History
        <Badge
          variant={section === "history" ? "secondary" : "outline"}
          className="ml-2 rounded-full"
        >
          {historyCount}
        </Badge>
      </Button>
    </div>
  );
}
