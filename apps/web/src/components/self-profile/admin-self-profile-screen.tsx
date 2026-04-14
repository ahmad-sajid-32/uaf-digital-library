"use client";

import { SelfProfileScreen } from "@/components/self-profile/self-profile-screen";

export function AdminSelfProfileScreen() {
  return (
    <SelfProfileScreen
      eyebrow="Admin Profile"
      description="Review your protected admin account identity and update the current self-service profile field without entering user-management flows."
    />
  );
}
