"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/contexts/LanguageContext";
import { formatSlotTime } from "@/lib/utils";
import {
  CalendarClock, Hourglass, Trash2, Loader2,
  Pencil, Clock, CheckCircle2,
} from "lucide-react";
import { RescheduleModal } from "@/components/booking/RescheduleModal";
import { Id } from "@/convex/_generated/dataModel";

const MONTHS_HE = ["ינו׳","פבר׳","מרץ","אפר׳","מאי","יוני","יולי","אוג׳","ספט׳","אוק׳","נוב׳","דצמ׳"];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const DAYS_HE   = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const DAYS_AR   = ["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];

function fmtDate(ms: number, lang: "he" | "ar") {
  const d = new Date(ms);
  return `${lang === "ar" ? DAYS_AR[d.getDay()] : DAYS_HE[d.getDay()]} ${d.getDate()} ${lang === "ar" ? MONTHS_AR[d.getMonth()] : MONTHS_HE[d.getMonth()]}`;
}

function fmtDateStr(dateStr: string, lang: "he" | "ar") {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${lang === "ar" ? DAYS_AR[dow] : DAYS_HE[dow]} ${d} ${lang === "ar" ? MONTHS_AR[m - 1] : MONTHS_HE[m - 1]}`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, lang }: { status: string; lang: "he" | "ar" }) {
  if (status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 shrink-0">
        <CheckCircle2 className="w-2.5 h-2.5" />
        {lang === "ar" ? "مؤكد" : "מאושר"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 shrink-0">
      <Clock className="w-2.5 h-2.5" />
      {lang === "ar" ? "بانتظار التأكيد" : "ממתין לאישור"}
    </span>
  );
}

// ─── Appointment row ──────────────────────────────────────────────────────────

function ApptRow({ appt, timezone, lang }: { appt: any; timezone: string; lang: "he" | "ar" }) {
  const cancelMutation  = useMutation(api.appointments.updateAppointmentStatus);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling,    setCancelling]    = useState(false);
  const [cancelError,   setCancelError]   = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  async function handleCancel() {
    setCancelError(null);
    setCancelling(true);
    try {
      await cancelMutation({ appointmentId: appt._id, status: "cancelled" });
      setConfirmCancel(false);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setCancelling(false);
    }
  }

  const serviceName = lang === "ar"
    ? (appt.service?.name?.ar ?? appt.service?.name?.he ?? "")
    : (appt.service?.name?.he ?? "");

  return (
    <>
      <li className="rounded-xl border border-border/40 bg-card/70 p-3 space-y-2 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{fmtDate(appt.startTime, lang)}</span>
              <span className="text-xs text-primary font-medium">{formatSlotTime(appt.startTime, timezone, lang)}</span>
            </div>
            {serviceName && <p className="text-xs text-muted-foreground truncate">{serviceName}</p>}
          </div>
          <StatusBadge status={appt.status} lang={lang} />
        </div>

        {!confirmCancel ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRescheduleOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium border border-primary/40 rounded-lg px-2.5 py-1 text-primary hover:bg-primary/10 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              {lang === "ar" ? "تغيير موعد" : "שנה מועד"}
            </button>
            <button
              onClick={() => setConfirmCancel(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium border border-border/60 rounded-lg px-2.5 py-1 text-muted-foreground hover:border-destructive/60 hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              {lang === "ar" ? "إلغاء" : "בטל תור"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap bg-destructive/5 rounded-lg px-2.5 py-1.5">
            <span className="text-[11px] font-medium text-foreground">
              {lang === "ar" ? "האם לבטל את התור?" : "לבטל את התור?"}
            </span>
            {cancelError && <span className="text-[11px] text-destructive">{cancelError}</span>}
            <div className="flex gap-1 mr-auto">
              <button
                disabled={cancelling}
                onClick={handleCancel}
                className="inline-flex items-center gap-1 text-[11px] font-medium bg-destructive text-destructive-foreground rounded-lg px-2.5 py-1 hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : (lang === "ar" ? "نعم، إلغاء" : "כן, בטל")}
              </button>
              <button
                onClick={() => { setConfirmCancel(false); setCancelError(null); }}
                className="inline-flex items-center text-[11px] font-medium border border-border/60 rounded-lg px-2.5 py-1 text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                {lang === "ar" ? "لا" : "חזרה"}
              </button>
            </div>
          </div>
        )}
      </li>

      {rescheduleOpen && (
        <RescheduleModal appt={appt} timezone={timezone} onClose={() => setRescheduleOpen(false)} />
      )}
    </>
  );
}

// ─── Waiting list row ─────────────────────────────────────────────────────────

function WaitingRow({ entry, customerPhone, lang }: { entry: any; customerPhone: string; lang: "he" | "ar" }) {
  const cancelEntry     = useMutation(api.waitingList.cancelEntry);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling,    setCancelling]    = useState(false);
  const [cancelError,   setCancelError]   = useState<string | null>(null);

  async function handleCancel() {
    setCancelError(null);
    setCancelling(true);
    try {
      await cancelEntry({ entryId: entry._id, customerPhone });
      setConfirmCancel(false);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setCancelling(false);
    }
  }

  const serviceName = lang === "ar"
    ? (entry.service?.name?.ar ?? entry.service?.name?.he ?? "")
    : (entry.service?.name?.he ?? "");

  return (
    <li className="rounded-xl border-2 border-amber-400/50 bg-amber-50/70 dark:bg-amber-900/20 p-3 space-y-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <span className="text-sm font-semibold text-foreground">{fmtDateStr(entry.date, lang)}</span>
          {serviceName && <p className="text-xs text-muted-foreground truncate">{serviceName}</p>}
        </div>
        {/* Waiting list badge — always visible, prominent */}
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-amber-200 text-amber-800 dark:bg-amber-800/60 dark:text-amber-200 shrink-0">
          <Hourglass className="w-3 h-3" />
          {lang === "ar" ? "قائمة انتظار" : "רשימת המתנה"}
        </span>
      </div>

      {!confirmCancel ? (
        <button
          onClick={() => setConfirmCancel(true)}
          className="inline-flex items-center gap-1 text-[11px] font-medium border border-border/60 rounded-lg px-2.5 py-1 text-muted-foreground hover:border-destructive/60 hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          {lang === "ar" ? "إلغاء الانتظار" : "הסר מהמתנה"}
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap bg-destructive/5 rounded-lg px-2.5 py-1.5">
          <span className="text-[11px] font-medium text-foreground">
            {lang === "ar" ? "إلغاء قائمة الانتظار؟" : "להסיר מרשימת ההמתנה?"}
          </span>
          {cancelError && <span className="text-[11px] text-destructive">{cancelError}</span>}
          <div className="flex gap-1 mr-auto">
            <button
              disabled={cancelling}
              onClick={handleCancel}
              className="inline-flex items-center gap-1 text-[11px] font-medium bg-destructive text-destructive-foreground rounded-lg px-2.5 py-1 hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : (lang === "ar" ? "نعم" : "כן, הסר")}
            </button>
            <button
              onClick={() => { setConfirmCancel(false); setCancelError(null); }}
              className="inline-flex items-center text-[11px] font-medium border border-border/60 rounded-lg px-2.5 py-1 text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              {lang === "ar" ? "لا" : "חזרה"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────────

export function UpcomingAppointmentsBanner({
  customerPhone,
  businessId,
}: {
  customerPhone: string;
  businessId: Id<"businesses">;
}) {
  const { lang } = useLang();

  const phone = customerPhone.trim();

  // Use getCustomerProfile (same as profile page) — no businessId filter, so we never miss appointments
  const allAppts = useQuery(
    api.appointments.getCustomerProfile,
    phone ? { customerPhone: phone } : "skip"
  );
  const allWaiting = useQuery(
    api.waitingList.getForCustomer,
    phone ? { customerPhone: phone } : "skip"
  );

  // Still loading
  if (allAppts === undefined && allWaiting === undefined) {
    return (
      <div className="glass rounded-2xl px-4 py-4 border border-border/60 shadow-sm flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  const upcoming = (allAppts ?? []).filter(
    a => a.startTime > Date.now() && a.status !== "cancelled"
  );

  const activeWaiting = (allWaiting ?? []).filter(
    e =>
      (e.status === "waiting" || e.status === "notified") &&
      e.date >= todayStr
  );

  type Item =
    | { kind: "appt";    data: typeof upcoming[0];      sortKey: number }
    | { kind: "waiting"; data: typeof activeWaiting[0]; sortKey: number };

  const items: Item[] = [
    ...upcoming.map(a => ({ kind: "appt" as const,    data: a, sortKey: a.startTime })),
    ...activeWaiting.map(e => {
      const [ey, em, ed] = e.date.split("-").map(Number);
      return { kind: "waiting" as const, data: e, sortKey: Date.UTC(ey, em - 1, ed) };
    }),
  ].sort((a, b) => a.sortKey - b.sortKey).slice(0, 5);

  if (!items.length) return null;

  const timezone = upcoming[0]?.business?.timezone ?? "Asia/Jerusalem";

  return (
    <div dir="rtl" className="glass rounded-2xl px-4 py-4 border border-border/60 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 shrink-0 text-primary" />
        <span className="text-sm font-bold text-foreground">
          {lang === "ar" ? "مواعيدك القادمة" : "התורים הקרובים שלך"}
        </span>
        <span className="text-xs text-muted-foreground mr-auto">
          {items.length === 1
            ? (lang === "ar" ? "موعد ١" : "תור אחד")
            : `${items.length} ${lang === "ar" ? "مواعيد" : "תורים"}`}
        </span>
      </div>

      {/* List */}
      <ul className="space-y-2">
        {items.map(item =>
          item.kind === "appt" ? (
            <ApptRow key={item.data._id} appt={item.data} timezone={timezone} lang={lang} />
          ) : (
            <WaitingRow key={item.data._id} entry={item.data} customerPhone={customerPhone.trim()} lang={lang} />
          )
        )}
      </ul>
    </div>
  );
}
