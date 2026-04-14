"use client";

// apps/web/src/components/assistant/admin-assistant-screen.tsx
/**
 * Admin wrapper for the shared assistant workspace.
 */

import * as React from "react";

import { SharedAssistantWorkspace } from "@/components/assistant/shared-assistant-workspace";

export function AdminAssistantScreen(): React.JSX.Element {
  return <SharedAssistantWorkspace workspaceLabel="Admin Assistant" />;
}
