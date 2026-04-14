"use client";

// apps/web/src/components/assistant/student-assistant-screen.tsx
/**
 * Student wrapper for the shared assistant workspace.
 */

import * as React from "react";

import { SharedAssistantWorkspace } from "@/components/assistant/shared-assistant-workspace";

export function StudentAssistantScreen(): React.JSX.Element {
  return <SharedAssistantWorkspace workspaceLabel="University Assistant" />;
}
