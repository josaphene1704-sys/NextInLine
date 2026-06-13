"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatPrice, formatSlotTime, toDateStr } from "@/lib/utils";
import { getColorByCode } from "@/lib/colors";
import { needsHairDetailsStep } from "@/lib/hair-details";
import { CustomerProfileDrawer } from "@/components/admin/CustomerProfileDrawer";
import { RescheduleModal } from "@/components/booking/RescheduleModal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, CalendarClock } from "lucide-react";

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
                  <span>· {appt.service.name.he} ({formatPrice(appt.service.price)})</span>
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
                    onClick={() => updateStatus({ appointmentId: appt._id, status: "cancelled" })}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="בטל"
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
}: {
  businessId: Id<"businesses">;
  timezone: string;
  businessName?: string;
}) {
  const barbers = useQuery(api.barbers.getAllByBusiness, { businessId });
  const [selectedBarber, setSelectedBarber] = useState<string>("");

  const fromMs = new Date().setUTCHours(0, 0, 0, 0);

  const appointments = useQuery(api.appointments.getUpcoming, {
    businessId,
    fromMs,
    barberId: selectedBarber ? (selectedBarber as Id<"barbers">) : undefined,
  });

  const updateStatus = useMutation(api.appointments.updateAppointmentStatus);

  const [customerDrawer, setCustomerDrawer] = useState<{ phone: string; name: string } | null>(null);

  if (!barbers || !appointments) {
    return <div className="text-muted-foreground text-sm">טוען תורים...</div>;
  }

  const byDate: Record<string, typeof appointments> = {};
  for (const appt of appointments) {
    const dateStr = toDateStr(new Date(appt.startTime));
    (byDate[dateStr] ??= []).push(appt);
  }

  const dates = Object.keys(byDate).sort();

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
            </div>

            <div className="space-y-2">
              {byDate[dateStr].map((appt) => (
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
          </div>
        );
      })}
    </div>
  );
}
