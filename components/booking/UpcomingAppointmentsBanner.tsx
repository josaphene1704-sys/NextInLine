"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/contexts/LanguageContext";
import { formatSlotTime } from "@/lib/utils";
import { CalendarClock, Hourglass, Trash2, Loader2 } from "lucide-react";
import { RescheduleModal } from "@/components/booking/RescheduleModal";
import { Id } from "@/convex/_generated/dataModel";

const MONTHS_HE = ["ינו׳","פבר׳","מרץ","אפר׳","מאי","יוני","יולי","אוג׳","ספט׳","אוק׳","נוב׳","דצמ׳"];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function fmtDate(ms: number, lang: "he" | "ar"): string {
  const d = new Date(ms);
  return `${d.getDate()} ${lang === "ar" ? MONTHS_AR[d.getMonth()] : MONTHS_HE[d.getMonth()]}`;
}

function fmtDateStr(dateStr: string, lang: "he" | "ar"): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d} ${lang === "ar" ? MONTHS_AR[m - 1] : MONTHS_HE[m - 1]}`;
}

// ─── Appointment row ──────────────────────────────────────────────────────────

function ApptRow({ appt, timezone, lang }: { appt: any; timezone: string; lang: "he" | "ar" }) {
  const cancelMutation = useMutation(api.appointments.updateAppointmentStatus);
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
      <li className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          <span className="font-medium text-foreground">{fmtDate(appt.startTime, lang)}</span>
          <span className="text-muted-foreground">{formatSlotTime(appt.startTime, timezone, lang)}</span>
          {serviceName && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-muted-foreground truncate max-w-[110px]">{serviceName}</span>
            </>
          )}
        </div>

        {!confirmCancel ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setRescheduleOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium border border-amber-400/50 rounded-lg px-2 py-1 text-amber-700 dark:text-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-900/20 transition-colors"
            >
              <CalendarClock className="w-3 h-3" />
              {lang === "ar" ? "تغيير" : "שנה מועד"}
            </button>
            <button
              onClick={() => setConfirmCancel(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium border border-border/50 rounded-lg px-2 py-1 text-muted-foreground hover:border-destructive/60 hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              {lang === "ar" ? "إلغاء" : "בטל"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-foreground">
              {lang === "ar" ? "לבטל?" : "לבטל את התור?"}
            </span>
            {cancelError && <span className="text-[11px] text-destructive">{cancelError}</span>}
            <div className="flex gap-1">
              <button
                disabled={cancelling}
                onClick={handleCancel}
                className="inline-flex items-center gap-1 text-[11px] font-medium bg-destructive text-destructive-foreground rounded-lg px-2 py-1 hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : (lang === "ar" ? "نعم" : "כן, בטל")}
              </button>
              <button
                onClick={() => { setConfirmCancel(false); setCancelError(null); }}
                className="inline-flex items-center text-[11px] font-medium border border-border/60 rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted/50 transition-colors"
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

function WaitingRow({
  entry,
  customerPhone,
  lang,
}: {
  entry: any;
  customerPhone: string;
  lang: "he" | "ar";
}) {
  const cancelEntry = useMutation(api.waitingList.cancelEntry);
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
    <li className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs flex-wrap">
        <span className="font-medium text-foreground">{fmtDateStr(entry.date, lang)}</span>
        {serviceName && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground truncate max-w-[110px]">{serviceName}</span>
          </>
        )}
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
          <Hourglass className="w-2.5 h-2.5" />
          {lang === "ar" ? "قائمة انتظار" : "רשימת המתנה"}
        </span>
      </div>

      {!confirmCancel ? (
        <button
          onClick={() => setConfirmCancel(true)}
          className="inline-flex items-center gap-1 text-[11px] font-medium border border-border/50 rounded-lg px-2 py-1 text-muted-foreground hover:border-destructive/60 hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          {lang === "ar" ? "إلغاء" : "הסר"}
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-foreground">
            {lang === "ar" ? "إلغاء الانتظار؟" : "להסיר מהמתנה?"}
          </span>
          {cancelError && <span className="text-[11px] text-destructive">{cancelError}</span>}
          <div className="flex gap-1">
            <button
              disabled={cancelling}
              onClick={handleCancel}
              className="inline-flex items-center gap-1 text-[11px] font-medium bg-destructive text-destructive-foreground rounded-lg px-2 py-1 hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : (lang === "ar" ? "نعم" : "כן")}
            </button>
            <button
              onClick={() => { setConfirmCancel(false); setCancelError(null); }}
              className="inline-flex items-center text-[11px] font-medium border border-border/60 rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted/50 transition-colors"
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

  const phoneDigits = customerPhone.replace(/\D/g, "");
  const skip = phoneDigits.length < 9;

  const allAppts = useQuery(
    api.appointments.getCustomerAppointments,
    skip ? "skip" : { customerPhone, businessId }
  );
  const allWaiting = useQuery(
    api.waitingList.getForCustomer,
    skip ? "skip" : { customerPhone }
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  const upcoming = (allAppts ?? []).filter(
    a => a.startTime > Date.now() && a.status !== "cancelled"
  );

  const activeWaiting = (allWaiting ?? []).filter(
    e =>
      e.businessId === businessId &&
      (e.status === "waiting" || e.status === "notified") &&
      e.date >= todayStr
  );

  type Item =
    | { kind: "appt";    data: typeof upcoming[0];       sortKey: number }
    | { kind: "waiting"; data: typeof activeWaiting[0];  sortKey: number };

  const items: Item[] = [
    ...upcoming.map(a => ({ kind: "appt" as const, data: a, sortKey: a.startTime })),
    ...activeWaiting.map(e => {
      const [ey, em, ed] = e.date.split("-").map(Number);
      return { kind: "waiting" as const, data: e, sortKey: Date.UTC(ey, em - 1, ed) };
    }),
  ].sort((a, b) => a.sortKey - b.sortKey).slice(0, 4);

  const timezone = upcoming[0]?.business?.timezone ?? "Asia/Jerusalem";

  if (!items.length) return null;

  return (
    <div className="glass rounded-2xl px-4 py-3 mb-6 border border-amber-400/30 bg-amber-50/40 dark:bg-amber-900/10 space-y-3">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <CalendarClock className="w-4 h-4 shrink-0" />
        <span className="text-xs font-semibold">
          {lang === "ar" ? "مواعيدك القادمة" : "התורים הקרובים שלך"}
        </span>
      </div>
      <ul className="space-y-3 divide-y divide-amber-200/40 dark:divide-amber-700/20">
        {items.map((item, i) => (
          <div key={item.data._id} className={i > 0 ? "pt-3" : ""}>
            {item.kind === "appt" ? (
              <ApptRow appt={item.data} timezone={timezone} lang={lang} />
            ) : (
              <WaitingRow entry={item.data} customerPhone={customerPhone} lang={lang} />
            )}
          </div>
        ))}
      </ul>
    </div>
  );
}
