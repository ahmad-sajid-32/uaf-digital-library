"use client";

import { SelfProfileScreen } from "@/components/self-profile/self-profile-screen";

export function StudentProfileScreen() {
  return (
    <SelfProfileScreen
      eyebrow="Student Profile"
      description="Review your protected account identity, edit the current self-service profile field, and manage account deletion through the real backend routes."
      allowAccountDeletion
    />
  );
}
