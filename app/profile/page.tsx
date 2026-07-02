"use client";

import { ProfileView } from "@/components/profile/ProfileView";

// Global profile — shows the customer's appointments across all salons.
export default function ProfilePage() {
  return <ProfileView backHref="/" />;
}
