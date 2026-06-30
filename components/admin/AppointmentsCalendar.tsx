"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatPrice, formatSlotTime, toDateStr } from "@/lib/utils";
import { downloadICS } from "@/lib/calendar";
import { getColorByCode } from "@/lib/colors";
import { needsHairDetailsStep } from "@/lib/hair-details";
import { CustomerProfileDrawer } from "@/components/admin/CustomerProfileDrawer";
import { RescheduleModal } from "@/components/booking/RescheduleModal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, CalendarClock, ClipboardList, Trash2, ChevronDown, Bell, MessageCircle } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pending:   "ממתין",
  confirmed: "מאושר",
  cancelled: "בוטל",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending:   "secondary",
  confirmed: "default",
  cancelled: "destructive",
};

const HAIR_LABEL: Record<string, string> = {
  hairLength:         "אורך",
  hairCondition:      "מצב",
  bleachHistory:      "הבהרות",
  grayHairPercentage: "שיבה",
  previousKeratin:    "קראטין קודם",
};

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

function buildRescheduleWhatsAppUrl(
  phone: string,
  name: string,
  newStartTime: number,
  timezone: string,
  serviceName: string,
  businessName: string,
): string {
  const date = new Date(newStartTime);
  const dateStr = date.toLocaleDateString("he-IL", {
    timeZone: timezone, weekday: "long", day: "numeric", month: "long",
  });
  const timeStr = date.toLocaleTimeString("he-IL", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const biz = businessName ? ` ב${businessName}` : "";
  const svc = serviceName ? ` ל${serviceName}` : "";
  const message = `היי ${name}! המועד של התור שלך${svc} עודכן לתאריך ${dateStr} בשעה ${timeStr}${biz}. נשמח לראותך! 💖`;
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

function buildCancelWhatsAppUrl(
  phone: string,
  name: string,
  startTime: number,
  timezone: string,
  serviceName: string,
  businessName: string,
): string {
  const date = new Date(startTime);
  const dateStr = date.toLocaleDateString("he-IL", {
    timeZone: timezone, weekday: "long", day: "numeric", month: "long",
  });
  const timeStr = date.toLocaleTimeString("he-IL", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const biz = businessName ? ` ב${businessName}` : "";
  const svc = serviceName ? ` ל${serviceName}` : "";
  const message = `היי ${name}! לצערנו, התור שלך${svc} שהיה בתאריך ${dateStr} בשעה ${timeStr}${biz} בוטל. ניתן לקבוע תור חדש באתר. מצטערים על אי הנוחות 🙏`;
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

function buildWaitingListWhatsAppUrl(
  phone: string,
  name: string,
  dateStr: string,
  freeTimes: string[],
  businessName: string,
  salonLink: string,
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateLabel = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("he-IL", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
  const biz = businessName ? ` ב${businessName}` : "";
  const timesLine = freeTimes.length > 0
    ? `\nשעות פנויות: ${freeTimes.join(", ")}`
    : "";
  const linkLine = salonLink ? `\nלקביעת תור: ${salonLink}` : "";
  const message =
    `היי ${name}! 📅\n` +
    `נפתח מקום פנוי${biz} לתאריך ${dateLabel}.` +
    timesLine +
    linkLine +
    `\nנשמח לראותך! 💖`;
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

function buildWhatsAppUrl(
  phone: string,
  name: string,
  startTime: number,
  timezone: string,
  serviceName: string,
  businessName: string,
): string {
  const date = new Date(startTime);
  const dateStr = date.toLocaleDateString("he-IL", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = date.toLocaleTimeString("he-IL", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const biz = businessName ? ` ב${businessName}` : "";
  const svc = serviceName ? ` ל${serviceName}` : "";
  const message = `היי ${name}! התור שלך${svc} נקבע בהצלחה לתאריך ${dateStr} בשעה ${timeStr}${biz}. נשמח לראותך! 💖`;
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

// ─── Per-appointment card (needs local state for the reschedule modal) ─────────

function AdminApptCard({
  appt,
  timezone,
  businessName,
  onOpenCustomer,
  updateStatus,
}: {
  appt: any;
  timezone: string;
  businessName: string;
  onOpenCustomer: (phone: string, name: string) => void;
  updateStatus: (args: { appointmentId: Id<"appointments">; status: "pending" | "confirmed" | "cancelled" }) => Promise<unknown>;
}) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  const timeStr = formatSlotTime(appt.startTime, timezone, "he");
  const endStr  = formatSlotTime(appt.endTime,   timezone, "he");
  const hd = appt.hairDetails;

  const hasHairDetails = !!(
    hd && (
      hd.hairLength || hd.hairCondition || hd.bleachHistory ||
      hd.grayHairPercentage || hd.previousKeratin ||
      hd.currentHairColorCode || hd.desiredHairColorCode ||
      hd.currentHairPhotoUrl  || hd.desiredHairPhotoUrl
    )
  );

  const serviceNeedsHair = appt.service
    ? needsHairDetailsStep({ name: appt.service.name, requiresHairDetails: appt.service.requiresHairDetails } as any)
    : false;

  function handleRescheduleSuccess(newStartTime: number) {
    const url = buildRescheduleWhatsAppUrl(
      appt.customerPhone,
      appt.customerName,
      newStartTime,
      timezone,
      appt.service?.name?.he ?? "",
      businessName,
    );
    window.open(url, "_blank", "noopener,noreferrer");
    const duration = appt.endTime - appt.startTime;
    const serviceName = appt.service?.name?.he ?? "תור";
    downloadICS({
      uid: `nextinline-${appt._id}`,
      startTime: newStartTime,
      endTime: newStartTime + duration,
      summary: `${serviceName}${businessName ? ` ב${businessName}` : ""}`,
      description: appt.barber?.name?.he ? `תור עם ${appt.barber.name.he}` : "",
      sequence: 1,
    }, "עדכון-תור.ics");
  }

  return (
    <>
      <Card className={appt.status === "cancelled" ? "opacity-50" : ""}>
        <CardContent className="py-3 space-y-3">

          {/* ── שורה ראשית ── */}
          <div className="flex items-start gap-3">
            <div className="text-xs font-mono text-muted-foreground shrink-0 w-20 pt-0.5">
              {timeStr}–{endStr}
            </div>
            <div className="flex-1 min-w-0">
              <button
                onClick={() => onOpenCustomer(appt.customerPhone, appt.customerName)}
                className="font-semibold text-sm hover:text-primary hover:underline transition-colors text-right"
              >
                {appt.customerName}
              </button>
              <div className="text-xs text-muted-foreground flex gap-2 flex-wrap mt-0.5">
                <span>{appt.customerPhone}</span>
                {appt.service && (
                  <span>· {appt.service.name.he} ({formatPrice(appt.finalPrice ?? appt.service.price)})</span>
                )}
                {appt.barber && <span>· {appt.barber.name.he}</span>}
              </div>
              {appt.notes && (
                <div className="text-xs text-muted-foreground mt-0.5 italic">{appt.notes}</div>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant={STATUS_VARIANT[appt.status]} className="text-xs">
                {STATUS_LABEL[appt.status]}
              </Badge>
              {appt.status === "pending" && (
                <button
                  onClick={async () => {
                    await updateStatus({ appointmentId: appt._id, status: "confirmed" });
                    const url = buildWhatsAppUrl(
                      appt.customerPhone,
                      appt.customerName,
                      appt.startTime,
                      timezone,
                      appt.service?.name?.he ?? "",
                      businessName,
                    );
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                  className="text-green-600 hover:text-green-700 transition-colors"
                  title="אשר ושלח WhatsApp"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              )}
              {appt.status !== "cancelled" && (
                <>
                  <button
                    onClick={() => setRescheduleOpen(true)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="שנה מועד ושלח WhatsApp"
                  >
                    <CalendarClock className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      await updateStatus({ appointmentId: appt._id, status: "cancelled" });
                      const url = buildCancelWhatsAppUrl(
                        appt.customerPhone, appt.customerName,
                        appt.startTime, timezone,
                        appt.service?.name?.he ?? "", businessName,
                      );
                      window.open(url, "_blank", "noopener,noreferrer");
                      const serviceName = appt.service?.name?.he ?? "תור";
                      downloadICS({
                        uid: `nextinline-${appt._id}`,
                        startTime: appt.startTime,
                        endTime: appt.endTime,
                        summary: `ביטול: ${serviceName}${businessName ? ` ב${businessName}` : ""}`,
                        cancelled: true,
                        sequence: 2,
                      }, "ביטול-תור.ics");
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="בטל ושלח WhatsApp"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── פרטי שיער ── */}
          {serviceNeedsHair && !hasHairDetails && (
            <div className="border-t border-border/50 pt-2">
              <p className="text-xs text-muted-foreground italic">לא הוזנו פרטי שיער</p>
            </div>
          )}

          {hasHairDetails && hd && (
            <div className="border-t border-border/50 pt-3 space-y-3">
              {(hd.hairLength || hd.hairCondition || hd.bleachHistory || hd.grayHairPercentage || hd.previousKeratin) && (
                <div className="flex flex-wrap gap-1.5">
                  {(["hairLength", "hairCondition", "bleachHistory", "grayHairPercentage", "previousKeratin"] as const).map((key) =>
                    hd[key] ? (
                      <span key={key} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1 border border-border/60">
                        <span className="text-muted-foreground">{HAIR_LABEL[key]}:</span>
                        <span className="font-medium">{hd[key]}</span>
                      </span>
                    ) : null
                  )}
                </div>
              )}
              {(hd.currentHairColorCode || hd.desiredHairColorCode) && (
                <div className="flex gap-3 flex-wrap">
                  {([["currentHairColorCode", "צבע נוכחי"] as const, ["desiredHairColorCode", "צבע רצוי"] as const]).map(([key, lbl]) => {
                    const color = getColorByCode(hd[key]);
                    if (!color) return null;
                    return (
                      <div key={key} className="flex items-center gap-2.5 bg-muted/50 rounded-xl px-2.5 py-2 border border-border/60">
                        <img src={color.imagePath} alt={color.name} className="w-14 h-14 rounded-lg object-cover border border-border shrink-0 shadow-sm" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground leading-none mb-1">{lbl}</p>
                          <p className="text-sm font-bold leading-none">{color.nameHe}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 max-w-[110px]">{color.code}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {(hd.currentHairPhotoUrl || hd.desiredHairPhotoUrl) && (
                <div className="flex gap-3 flex-wrap">
                  {[{ url: hd.currentHairPhotoUrl, label: "שיער נוכחי" }, { url: hd.desiredHairPhotoUrl, label: "שיער רצוי" }].map(({ url, label }) =>
                    url ? (
                      <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-1">
                        <img src={url} alt={label} className="w-20 h-20 rounded-xl object-cover border border-border group-hover:border-primary/60 transition-colors shadow-sm" />
                        <span className="text-[10px] text-muted-foreground">{label}</span>
                      </a>
                    ) : null
                  )}
                </div>
              )}
            </div>
          )}

        </CardContent>
      </Card>

      {rescheduleOpen && (
        <RescheduleModal
          appt={appt}
          timezone={timezone}
          onClose={() => setRescheduleOpen(false)}
          onSuccess={handleRescheduleSuccess}
        />
      )}
    </>
  );
}

// ─── Main calendar ─────────────────────────────────────────────────────────────

export function AppointmentsCalendar({
  businessId,
  timezone,
  businessName = "",
  salonLink = "",
}: {
  businessId: Id<"businesses">;
  timezone: string;
  businessName?: string;
  salonLink?: string;
}) {
  const barbers = useQuery(api.barbers.getAllByBusiness, { businessId });
  const [selectedBarber, setSelectedBarber] = useState<string>("");

  const fromMs = new Date().setUTCHours(0, 0, 0, 0);

  const appointments = useQuery(api.appointments.getUpcoming, {
    businessId,
    fromMs,
    barberId: selectedBarber ? (selectedBarber as Id<"barbers">) : undefined,
  });

  const updateStatus  = useMutation(api.appointments.updateAppointmentStatus);
  const removeWaiting = useMutation(api.waitingList.removeEntry);

  const waitingListAll = useQuery(api.waitingList.getForBusiness, { businessId });

  const [customerDrawer,     setCustomerDrawer]     = useState<{ phone: string; name: string } | null>(null);
  const [waitingOpenDates,   setWaitingOpenDates]   = useState<Set<string>>(new Set());

  function toggleWaitingDate(dateStr: string) {
    setWaitingOpenDates((prev) => {
      const next = new Set(prev);
      next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr);
      return next;
    });
  }

  if (!barbers || !appointments) {
    return <div className="text-muted-foreground text-sm">טוען תורים...</div>;
  }

  // Group appointments by date
  const byDate: Record<string, typeof appointments> = {};
  for (const appt of appointments) {
    const dateStr = toDateStr(new Date(appt.startTime));
    (byDate[dateStr] ??= []).push(appt);
  }

  // Group waiting list by date — only future / today entries with status "waiting" or "notified"
  const todayStr = toDateStr(new Date());
  const byWaiting: Record<string, NonNullable<typeof waitingListAll>> = {};
  for (const entry of waitingListAll ?? []) {
    if (entry.date < todayStr) continue;
    if (entry.status === "booked" || entry.status === "expired") continue;
    (byWaiting[entry.date] ??= []).push(entry);
  }

  // Merge date keys so dates with only waiting-list entries are shown too
  const dates = Array.from(new Set([...Object.keys(byDate), ...Object.keys(byWaiting)])).sort();

  return (
    <div className="space-y-4">
      {/* Barber filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground shrink-0">ספרית:</span>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedBarber("")}
            className={`px-3 h-8 rounded-full border text-xs font-medium transition-colors ${
              selectedBarber === ""
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary"
            }`}
          >
            כולן
          </button>
          {barbers.map((b) => (
            <button
              key={b._id}
              onClick={() => setSelectedBarber(b._id === selectedBarber ? "" : b._id)}
              className={`px-3 h-8 rounded-full border text-xs font-medium transition-colors ${
                selectedBarber === b._id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary"
              }`}
            >
              {b.name.he}
            </button>
          ))}
        </div>
      </div>

      {dates.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">
          אין תורים קרובים
        </p>
      )}

      {/* Customer profile drawer */}
      {customerDrawer && (
        <CustomerProfileDrawer
          customerPhone={customerDrawer.phone}
          customerName={customerDrawer.name}
          timezone={timezone}
          onClose={() => setCustomerDrawer(null)}
        />
      )}

      {dates.map((dateStr) => {
        const d = new Date(dateStr + "T00:00:00Z");
        const dayName = DAY_NAMES[d.getUTCDay()];
        const isToday = dateStr === toDateStr(new Date());
        const display = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;

        const waitingForDate = byWaiting[dateStr] ?? [];

        // Freed slots = cancelled appointments on this date whose time has been freed
        const cancelledOnDate = (byDate[dateStr] ?? []).filter(a => a.status === "cancelled");
        const freeTimes = cancelledOnDate.map(a => formatSlotTime(a.startTime, timezone, "he"));
        const hasFreedSlots = freeTimes.length > 0 && waitingForDate.length > 0;

        // Auto-expand the waiting list when a slot was freed
        const isWaitingOpen = waitingOpenDates.has(dateStr) || hasFreedSlots;

        return (
          <div key={dateStr}>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm font-semibold">
                {dayName}, {display}
              </div>
              {isToday && (
                <Badge variant="default" className="text-xs py-0">
                  היום
                </Badge>
              )}
              {/* Alert badge when slot freed + waiting list exists */}
              {hasFreedSlots && (
                <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 animate-pulse">
                  <Bell className="w-3 h-3" />
                  יש ממתינים — שעה התפנתה!
                </span>
              )}
            </div>

            <div className="space-y-2">
              {(byDate[dateStr] ?? []).map((appt) => (
                <AdminApptCard
                  key={appt._id}
                  appt={appt}
                  timezone={timezone}
                  businessName={businessName}
                  onOpenCustomer={(phone, name) => setCustomerDrawer({ phone, name })}
                  updateStatus={updateStatus}
                />
              ))}
            </div>

            {/* Waiting list for this date */}
            {waitingForDate.length > 0 && (
              <div className="mt-3">
                {/* Alert banner when freed slots exist */}
                {hasFreedSlots && (
                  <div className="mb-2 flex items-start gap-2 rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-700/40 px-3 py-2">
                    <Bell className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-orange-800 dark:text-orange-300">
                      <span className="font-semibold">תור התפנה! </span>
                      שעות שהתפנו: <span className="font-mono font-semibold">{freeTimes.join(", ")}</span>
                      <span className="text-orange-600 dark:text-orange-400"> — שלחי הודעה לממתינות</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => toggleWaitingDate(dateStr)}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  רשימת המתנה ({waitingForDate.length})
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${isWaitingOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isWaitingOpen && (
                  <div className="mt-2 space-y-1.5">
                    {waitingForDate.map((entry, idx) => {
                      const timePrefLabel: Record<string, string> = {
                        morning: "בוקר",
                        evening: "ערב",
                        any:     "כל היום",
                      };
                      const waUrl = buildWaitingListWhatsAppUrl(
                        entry.customerPhone,
                        entry.customerName,
                        dateStr,
                        freeTimes,
                        businessName,
                        salonLink,
                      );
                      return (
                        <div
                          key={entry._id}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-xs transition-colors ${
                            hasFreedSlots
                              ? "border-orange-300 bg-orange-50/60 dark:bg-orange-900/10 dark:border-orange-700/40"
                              : "border-border/60 bg-muted/30"
                          }`}
                        >
                          <span className="font-mono text-muted-foreground w-4 shrink-0">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold">{entry.customerName}</span>
                            <span className="text-muted-foreground mx-1">·</span>
                            <span dir="ltr" className="text-muted-foreground">{entry.customerPhone}</span>
                            <span className="text-muted-foreground mx-1">·</span>
                            <span className="text-muted-foreground">{timePrefLabel[entry.timePreference]}</span>
                            {entry.notes && (
                              <span className="text-muted-foreground italic mr-1">({entry.notes})</span>
                            )}
                          </div>
                          <Badge
                            variant={entry.status === "notified" ? "default" : "secondary"}
                            className="text-[10px] py-0 shrink-0"
                          >
                            {entry.status === "notified" ? "עודכן" : "ממתין"}
                          </Badge>
                          {/* WhatsApp send button */}
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="שלח WhatsApp עם השעות הפנויות"
                            className={`shrink-0 transition-colors ${
                              hasFreedSlots
                                ? "text-green-600 hover:text-green-700"
                                : "text-muted-foreground hover:text-green-600"
                            }`}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => removeWaiting({ entryId: entry._id })}
                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            title="הסר מהרשימה"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
