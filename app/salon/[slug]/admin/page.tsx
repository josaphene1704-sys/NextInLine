"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { AdminSessionProvider, useAdminSession } from "@/contexts/AdminSessionContext";
import { Doc } from "@/convex/_generated/dataModel";
import { BusinessSettings } from "@/components/admin/BusinessSettings";
import { ServicesManager } from "@/components/admin/ServicesManager";
import { SpecialSchedulesManager } from "@/components/admin/SpecialSchedulesManager";
import { AppointmentsCalendar } from "@/components/admin/AppointmentsCalendar";
import { PasswordSettings } from "@/components/admin/PasswordSettings";
import { GalleryManager } from "@/components/admin/GalleryManager";
import { SubscriptionManager } from "@/components/admin/SubscriptionManager";

const TABS = [
  { id: "business",  label: "פרטי העסק" },
  { id: "services",  label: "שירותים" },
  { id: "schedule",  label: "ימים מיוחדים" },
  { id: "calendar",  label: "תורים" },
  { id: "gallery",   label: "גלרייה" },
  { id: "billing",   label: "מנוי וחיוב" },
  { id: "settings",  label: "הגדרות" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SalonAdminPage() {
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

  return (
    <AdminSessionProvider slug={slug}>
      <SalonAdminDashboard slug={slug} business={business} />
    </AdminSessionProvider>
  );
}

function SalonAdminDashboard({
  slug,
  business,
}: {
  slug: string;
  business: Doc<"businesses">;
}) {
  const [tab, setTab] = useState<TabId>("business");
  const router = useRouter();
  const { session, hydrated, clearSession } = useAdminSession();

  // Server-side validation of the stored token — a stale/rotated session must
  // not render the editor (its writes would silently fail otherwise). Reactive,
  // so deleting the session row (e.g. password change) kicks this tab to login.
  const sessionValid = useQuery(
    api.settings.validateSession,
    session ? { token: session.token, businessId: business._id } : "skip"
  );

  const localMatch = !!session && session.businessId === business._id;

  useEffect(() => {
    if (!hydrated) return;
    if (!localMatch) {
      router.replace(`/salon/${slug}?admin=1`);
      return;
    }
    if (sessionValid === false) {
      clearSession();
      router.replace(`/salon/${slug}?admin=1`);
    }
  }, [hydrated, localMatch, sessionValid, router, slug, clearSession]);

  if (!hydrated || !localMatch || sessionValid !== true) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        טוען...
      </div>
    );
  }

  return (
    <div className="min-h-screen" dir="rtl">
      <header className="sticky top-0 z-20 glass-header px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">ניהול — {business.name.he}</h1>
          <a
            href={`/salon/${slug}`}
            className="glass-badge text-xs font-medium text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5"
          >
            ← חזרה לאתר
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="glass rounded-2xl p-1.5 mb-8 flex gap-1 overflow-x-auto">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "px-4 py-2 text-sm whitespace-nowrap rounded-xl transition-all duration-200",
                tab === id
                  ? "bg-white text-primary font-semibold shadow-glass"
                  : "font-medium text-muted-foreground hover:text-foreground hover:bg-white/50"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "business"  && <BusinessSettings business={business} />}
        {tab === "services"  && <ServicesManager  businessId={business._id} />}
        {tab === "schedule"  && <SpecialSchedulesManager businessId={business._id} />}
        {tab === "gallery"   && <GalleryManager   businessId={business._id} />}
        {tab === "billing"   && <SubscriptionManager businessId={business._id} />}
        {tab === "settings"  && <PasswordSettings  businessId={business._id} />}
        {tab === "calendar"  && (
          <AppointmentsCalendar
            businessId={business._id}
            timezone={business.timezone ?? "UTC"}
            businessName={business.name.he}
            salonLink={business.salonLink ?? (business.slug ? `/salon/${business.slug}` : "")}
          />
        )}
      </main>
    </div>
  );
}
