"use client";

import { SelfProfileScreen } from "@/components/self-profile/self-profile-screen";

export function StudentProfileScreen() {
  return (
    <SelfProfileScreen
      eyebrow="Student Profile"
      description="Review your account details, update your profile, and manage account deletion."
      allowAccountDeletion
    />
  );
}
