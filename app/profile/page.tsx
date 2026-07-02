"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { formatPrice, formatSlotTime } from "@/lib/utils";
import { getColorByCode } from "@/lib/colors";
import { RescheduleModal } from "@/components/booking/RescheduleModal";
import {
  ArrowRight, Calendar, CheckCircle2, Clock, Sparkles, User,
  CalendarClock, Trash2, Loader2, Hourglass,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Constants ────────────────────────────────────────────────────────────────

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
  hairLength: "אורך", hairCondition: "מצב", bleachHistory: "הבהרות",
  grayHairPercentage: "שיבה", previousKeratin: "קראטין",
};
// ─── Waiting list card ────────────────────────────────────────────────────────

function WaitingListCard({ entry }: { entry: any }) {
  const { user } = useAuth();
  const cancelEntry = useMutation(api.waitingList.cancelEntry);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling,    setCancelling]    = useState(false);
  const [cancelError,   setCancelError]   = useState<string | null>(null);

  const [y, m, d] = entry.date.split("-").map(Number);
  const dateDisplay = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("he-IL", {
    weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

  const timePrefLabel: Record<string, string> = {
    morning: "בוקר (עד 13:00)",
    evening: "אחה\"צ / ערב",
    any:     "כל היום",
  };

  async function handleCancel() {
    if (!user) return;
    setCancelError(null);
    setCancelling(true);
    try {
      await cancelEntry({ entryId: entry._id, customerPhone: user.phone });
      setConfirmCancel(false);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "שגיאה בביטול");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="glass rounded-2xl overflow-hidden border border-amber-400/40 bg-amber-50/20 dark:bg-amber-900/5">
      <div className="p-4 space-y-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">
              {entry.service?.name?.he ?? "כל שירות"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{dateDisplay}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              עדיפות שעה: {timePrefLabel[entry.timePreference]}
            </p>
            {entry.business?.name?.he && (
              <p className="text-xs text-muted-foreground">{entry.business.name.he}</p>
            )}
          </div>
          <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            <Hourglass className="w-3 h-3" />
            רשימת המתנה
          </span>
        </div>

        {entry.notes && (
          <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2">{entry.notes}</p>
        )}

        {/* Cancel */}
        <div className="border-t border-border/40 pt-3">
          {!confirmCancel ? (
            <button
              onClick={() => setConfirmCancel(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-border/60 rounded-xl px-3 py-2 hover:border-destructive/60 hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              הסר מרשימת המתנה
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-center font-medium">להסיר מרשימת ההמתנה?</p>
              {cancelError && (
                <p className="text-xs text-destructive text-center">{cancelError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={cancelling}
                  onClick={handleCancel}
                >
                  {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "כן, הסר"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => { setConfirmCancel(false); setCancelError(null); }}
                >
                  חזרה
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Appointment card ─────────────────────────────────────────────────────────

function AppointmentCard({ appt, timezone }: { appt: any; timezone: string }) {
  const cancel = useMutation(api.appointments.updateAppointmentStatus);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const isUpcoming = appt.startTime > Date.now() && appt.status !== "cancelled";

  const start = formatSlotTime(appt.startTime, timezone, "he");
  const end   = formatSlotTime(appt.endTime,   timezone, "he");
  const [y, m, d] = new Date(appt.startTime).toISOString().slice(0, 10).split("-").map(Number);
  const dateDisplay = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("he-IL", {
    weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

  const hd = appt.hairDetails;
  const currentColor = hd?.currentHairColorCode ? getColorByCode(hd.currentHairColorCode) : null;
  const desiredColor = hd?.desiredHairColorCode ? getColorByCode(hd.desiredHairColorCode) : null;

  async function handleCancel() {
    setCancelError(null);
    setCancelling(true);
    try {
      await cancel({ appointmentId: appt._id, status: "cancelled" });
      setConfirmCancel(false);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "שגיאה בביטול");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <div className={`glass rounded-2xl overflow-hidden ${appt.status === "cancelled" ? "opacity-60" : ""}`}>
        <div className="p-4 space-y-3">

          {/* Top row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{appt.service?.name?.he ?? "שירות"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{dateDisplay} · {start}–{end}</p>
            </div>
            <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-1 ${STATUS_COLOR[appt.status]}`}>
              {STATUS_LABEL[appt.status]}
            </span>
          </div>

          {(appt.finalPrice ?? appt.service?.price) && (
            <p className="text-xs text-muted-foreground">{formatPrice(appt.finalPrice ?? appt.service!.price)}</p>
          )}

          {/* Hair details */}
          {hd && (
            <div className="border-t border-border/40 pt-3 space-y-2">
              {(["hairLength","hairCondition","bleachHistory","grayHairPercentage","previousKeratin"] as const).some(k => hd[k]) && (
                <div className="flex flex-wrap gap-1.5">
                  {(["hairLength","hairCondition","bleachHistory","grayHairPercentage","previousKeratin"] as const).map(k =>
                    hd[k] ? (
                      <span key={k} className="text-[11px] bg-muted rounded-full px-2.5 py-1 border border-border/50">
                        <span className="text-muted-foreground">{HAIR_LABEL[k]}: </span>{hd[k]}
                      </span>
                    ) : null
                  )}
                </div>
              )}
              {(currentColor || desiredColor) && (
                <div className="flex gap-2 flex-wrap">
                  {(["currentHairColorCode","desiredHairColorCode"] as const).map(key => {
                    const color = getColorByCode(hd[key]);
                    if (!color) return null;
                    const lbl = key === "currentHairColorCode" ? "צבע נוכחי" : "צבע רצוי";
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

          {appt.notes && (
            <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2">{appt.notes}</p>
          )}

          {/* Action buttons — only for upcoming non-cancelled appointments */}
          {isUpcoming && (
            <div className="border-t border-border/40 pt-3">
              {!confirmCancel ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setRescheduleOpen(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium border border-border/60 rounded-xl py-2 hover:border-primary/60 hover:text-primary transition-colors"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    שנה מועד
                  </button>
                  <button
                    onClick={() => setConfirmCancel(true)}
                    className="flex items-center justify-center gap-1.5 text-xs font-medium border border-border/60 rounded-xl px-3 py-2 hover:border-destructive/60 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    בטל תור
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-center font-medium">לבטל את התור?</p>
                  {cancelError && (
                    <p className="text-xs text-destructive text-center">{cancelError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      disabled={cancelling}
                      onClick={handleCancel}
                    >
                      {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "כן, בטל"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => { setConfirmCancel(false); setCancelError(null); }}
                    >
                      חזרה
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reschedule modal */}
      {rescheduleOpen && (
        <RescheduleModal
          appt={appt}
          timezone={timezone}
          onClose={() => setRescheduleOpen(false)}
        />
      )}
    </>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color = "text-foreground" }: {
  icon: React.ReactNode; value: number; label: string; color?: string;
}) {
  return (
    <div className="glass rounded-xl p-3 text-center space-y-1">
      <div className={`flex justify-center ${color}`}>{icon}</div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user } = useAuth();
  const router   = useRouter();

  const appointments = useQuery(
    api.appointments.getCustomerProfile,
    user ? { customerPhone: user.phone } : "skip"
  );
  const waitingEntries = useQuery(
    api.waitingList.getForCustomer,
    user ? { customerPhone: user.phone } : "skip"
  );

  if (user === null) { router.replace("/"); return null; }
  if (!user) return null;

  const now      = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);

  const upcoming  = appointments?.filter(a => a.startTime > now && a.status !== "cancelled") ?? [];
  const past      = appointments?.filter(a => a.startTime <= now || a.status === "cancelled") ?? [];
  const confirmed = appointments?.filter(a => a.status === "confirmed").length ?? 0;

  const activeWaiting = (waitingEntries ?? []).filter(
    e => (e.status === "waiting" || e.status === "notified") && e.date >= todayStr
  );

  type UpcomingItem =
    | { kind: "appointment"; data: typeof upcoming[0];      sortKey: number }
    | { kind: "waiting";     data: typeof activeWaiting[0]; sortKey: number };

  const allUpcoming: UpcomingItem[] = [
    ...upcoming.map(a => ({ kind: "appointment" as const, data: a, sortKey: a.startTime })),
    ...activeWaiting.map(e => {
      const [ey, em, ed] = e.date.split("-").map(Number);
      return { kind: "waiting" as const, data: e, sortKey: Date.UTC(ey, em - 1, ed) };
    }),
  ].sort((a, b) => a.sortKey - b.sortKey);

  const timezone = appointments?.[0]?.business?.timezone ?? "UTC";

  return (
    <main className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-20 glass-header px-4 h-14 flex items-center gap-3 max-w-2xl mx-auto">
        <button onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-base flex-1">הפרופיל שלי</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Identity */}
        <div className="glass rounded-2xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold truncate">{user.name}</p>
            <p className="text-sm text-muted-foreground font-mono">{user.phone}</p>
          </div>
        </div>

        {/* Stats */}
        {appointments !== undefined && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Calendar className="w-4 h-4" />}       value={appointments.length}              label="סה״כ תורים" />
            <StatCard icon={<Clock className="w-4 h-4" />}          value={allUpcoming.length}               label="קרובים"     color="text-primary" />
            <StatCard icon={<CheckCircle2 className="w-4 h-4" />}   value={confirmed}                        label="אושרו"       color="text-green-600" />
          </div>
        )}

        {(appointments === undefined || waitingEntries === undefined) && (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {appointments?.length === 0 && activeWaiting.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">עוד לא הזמנת תור</p>
            <button onClick={() => router.push("/")} className="mt-4 text-sm text-primary hover:underline">
              הזמני תור עכשיו →
            </button>
          </div>
        )}

        {/* Upcoming (appointments + waiting list entries, sorted by date) */}
        {allUpcoming.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">תורים קרובים</h2>
            {allUpcoming.map(item =>
              item.kind === "appointment" ? (
                <AppointmentCard key={item.data._id} appt={item.data} timezone={timezone} />
              ) : (
                <WaitingListCard key={item.data._id} entry={item.data} />
              )
            )}
          </section>
        )}

        {/* History */}
        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">היסטוריה</h2>
            {past.map(appt => (
              <AppointmentCard key={appt._id} appt={appt} timezone={timezone} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
