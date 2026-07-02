"use client";
export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ProfileView } from "@/components/profile/ProfileView";

// Per-salon profile — reached from a salon's header, keeps the URL under the
// salon and shows only the customer's appointments at THIS salon.
export default function SalonProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const business = useQuery(api.businesses.getBySlug, { slug });

  if (business === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        טוען...
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex items-center justify-center min-h-screen text-destructive">
        הסלון לא נמצא במערכת
      </div>
    );
  }

  return <ProfileView filterBusinessId={business._id} backHref={`/salon/${slug}`} />;
}
