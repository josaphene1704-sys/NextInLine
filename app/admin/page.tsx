"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { BusinessSettings } from "@/components/admin/BusinessSettings";
import { ServicesManager } from "@/components/admin/ServicesManager";
import { BarbersManager } from "@/components/admin/BarbersManager";
import { SpecialSchedulesManager } from "@/components/admin/SpecialSchedulesManager";
import { AppointmentsCalendar } from "@/components/admin/AppointmentsCalendar";

const TABS = [
  { id: "business",  label: "פרטי העסק" },
  { id: "services",  label: "שירותים" },
  { id: "barbers",   label: "ספרים" },
  { id: "schedule",  label: "ימים מיוחדים" },
  { id: "calendar",  label: "תורים" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>("business");
  const businesses = useQuery(api.businesses.getAll);
  const business = businesses?.[0];

  if (businesses === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        טוען...
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex items-center justify-center min-h-screen text-destructive">
        לא נמצא עסק במערכת
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30" dir="rtl">
      <header className="bg-card border-b px-6 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">ניהול — {business.name.he}</h1>
          <a
            href="/"
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-border/60 rounded-full px-3 py-1.5"
          >
            ← חזרה לאתר
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Tab bar — scrollable on narrow screens */}
        <div className="flex gap-0 border-b mb-8 overflow-x-auto">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium -mb-px border-b-2 whitespace-nowrap transition-colors",
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "business"  && <BusinessSettings business={business} />}
        {tab === "services"  && <ServicesManager  businessId={business._id} />}
        {tab === "barbers"   && <BarbersManager   businessId={business._id} />}
        {tab === "schedule"  && <SpecialSchedulesManager businessId={business._id} />}
        {tab === "calendar"  && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <a
                href="/admin/appointments"
                className="text-xs font-medium border border-border/60 rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                ניהול כל התורים →
              </a>
            </div>
            <AppointmentsCalendar
              businessId={business._id}
              timezone={business.timezone ?? "UTC"}
            />
          </div>
        )}
      </main>
    </div>
  );
}
