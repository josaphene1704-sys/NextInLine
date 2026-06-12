"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice, formatSlotTime } from "@/lib/utils";
import { getColorByCode } from "@/lib/colors";
import { ArrowRight, Calendar, CheckCircle2, Clock, XCircle, Sparkles, User } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pending:   "ממתין לאישור",
  confirmed: "מאושר",
  cancelled: "בוטל",
};
const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100  text-red-700  dark:bg-red-900/30  dark:text-red-400",
};

const HAIR_LABEL: Record<string, string> = {
  hairLength:         "אורך",
  hairCondition:      "מצב",
  bleachHistory:      "הבהרות",
  grayHairPercentage: "שיבה",
  previousKeratin:    "קראטין",
};

export default function ProfilePage() {
  const { user } = useAuth();
  const router   = useRouter();

  useEffect(() => {
    if (user === null) router.replace("/");
  }, [user, router]);

  const appointments = useQuery(
    api.appointments.getCustomerProfile,
    user ? { customerPhone: user.phone } : "skip"
  );

  if (!user) return null;

  const now = Date.now();
  const upcoming  = appointments?.filter((a) => a.startTime > now && a.status !== "cancelled") ?? [];
  const past      = appointments?.filter((a) => a.startTime <= now || a.status === "cancelled") ?? [];
  const confirmed = appointments?.filter((a) => a.status === "confirmed").length ?? 0;

  const business = appointments?.[0]?.business;
  const timezone = business?.timezone ?? "UTC";

  return (
    <main className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-20 glass-header px-4 h-14 flex items-center gap-3 max-w-2xl mx-auto">
        <button onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-base flex-1">הפרופיל שלי</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Identity card */}
        <div className="glass rounded-2xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold truncate">{user.name}</p>
            <p className="text-sm text-muted-foreground font-mono">{user.phone}</p>
          </div>
        </div>

        {/* Stats row */}
        {appointments !== undefined && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Calendar className="w-4 h-4" />} value={appointments.length} label="סה״כ תורים" />
            <StatCard icon={<Clock className="w-4 h-4" />}    value={upcoming.length}      label="קרובים" color="text-primary" />
            <StatCard icon={<CheckCircle2 className="w-4 h-4" />} value={confirmed}         label="אושרו" color="text-green-600" />
          </div>
        )}

        {/* Loading */}
        {appointments === undefined && (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {/* Empty */}
        {appointments?.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">עוד לא הזמנת תור</p>
            <button onClick={() => router.push("/")}
              className="mt-4 text-sm text-primary hover:underline">הזמני תור עכשיו →</button>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">תורים קרובים</h2>
            {upcoming.map((appt) => (
              <AppointmentCard key={appt._id} appt={appt} timezone={timezone} />
            ))}
          </section>
        )}

        {/* History */}
        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">היסטוריה</h2>
            {past.map((appt) => (
              <AppointmentCard key={appt._id} appt={appt} timezone={timezone} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color = "text-foreground" }: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <div className="glass rounded-xl p-3 text-center space-y-1">
      <div className={`flex justify-center ${color}`}>{icon}</div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

// ─── Appointment card ─────────────────────────────────────────────────────────

function AppointmentCard({ appt, timezone }: { appt: any; timezone: string }) {
  const start = formatSlotTime(appt.startTime, timezone, "he");
  const end   = formatSlotTime(appt.endTime,   timezone, "he");

  const [y, m, d] = new Date(appt.startTime)
    .toISOString().slice(0, 10).split("-").map(Number);
  const dateDisplay = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("he-IL", {
    weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

  const hd = appt.hairDetails;
  const currentColor = hd?.currentHairColorCode ? getColorByCode(hd.currentHairColorCode) : null;
  const desiredColor = hd?.desiredHairColorCode ? getColorByCode(hd.desiredHairColorCode) : null;

  return (
    <div className={`glass rounded-2xl overflow-hidden ${appt.status === "cancelled" ? "opacity-60" : ""}`}>
      <div className="p-4 space-y-3">

        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{appt.service?.name?.he ?? "שירות"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dateDisplay} · {start}–{end}
            </p>
            {appt.barber && (
              <p className="text-xs text-muted-foreground">מעצבת: {appt.barber.name?.he}</p>
            )}
          </div>
          <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-1 ${STATUS_COLOR[appt.status]}`}>
            {STATUS_LABEL[appt.status]}
          </span>
        </div>

        {/* Price */}
        {appt.service?.price && (
          <p className="text-xs text-muted-foreground">{formatPrice(appt.service.price)}</p>
        )}

        {/* Hair details */}
        {hd && (
          <div className="border-t border-border/40 pt-3 space-y-2">

            {/* Text chips */}
            {(["hairLength","hairCondition","bleachHistory","grayHairPercentage","previousKeratin"] as const).some((k) => hd[k]) && (
              <div className="flex flex-wrap gap-1.5">
                {(["hairLength","hairCondition","bleachHistory","grayHairPercentage","previousKeratin"] as const).map((k) =>
                  hd[k] ? (
                    <span key={k} className="text-[11px] bg-muted rounded-full px-2.5 py-1 border border-border/50">
                      <span className="text-muted-foreground">{HAIR_LABEL[k]}: </span>{hd[k]}
                    </span>
                  ) : null
                )}
              </div>
            )}

            {/* Catalog colors */}
            {(currentColor || desiredColor) && (
              <div className="flex gap-2 flex-wrap">
                {([["currentHairColorCode","צבע נוכחי"], ["desiredHairColorCode","צבע רצוי"]] as const).map(([key, lbl]) => {
                  const color = getColorByCode(hd[key]);
                  if (!color) return null;
                  return (
                    <div key={key} className="flex items-center gap-2 bg-muted/50 rounded-xl px-2.5 py-2 border border-border/50">
                      <img src={color.imagePath} alt={color.name} className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{lbl}</p>
                        <p className="text-xs font-bold leading-none">{color.nameHe}</p>
                        <p className="text-[10px] text-muted-foreground">{color.code}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Customer photos */}
            {(hd.currentHairPhotoUrl || hd.desiredHairPhotoUrl) && (
              <div className="flex gap-2 flex-wrap">
                {[{url: hd.currentHairPhotoUrl, label:"שיער נוכחי"}, {url: hd.desiredHairPhotoUrl, label:"שיער רצוי"}].map(({url, label}) =>
                  url ? (
                    <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="group">
                      <img src={url} alt={label} className="w-16 h-16 rounded-xl object-cover border border-border group-hover:border-primary/60 transition-colors" />
                      <p className="text-[10px] text-muted-foreground text-center mt-0.5">{label}</p>
                    </a>
                  ) : null
                )}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {appt.notes && (
          <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2">{appt.notes}</p>
        )}
      </div>
    </div>
  );
}
