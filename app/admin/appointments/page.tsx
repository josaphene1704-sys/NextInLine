"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { AdminSessionProvider, useAdminSession } from "@/contexts/AdminSessionContext";
import { formatPrice, formatSlotTime, toDateStr } from "@/lib/utils";
import { downloadICS } from "@/lib/calendar";
import { getColorByCode } from "@/lib/colors";
import { needsHairDetailsStep } from "@/lib/hair-details";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const STATUS_LABEL: Record<string, string> = {
  pending:   "ממתין לאישור",
  confirmed: "מאושר",
  cancelled: "בוטל",
};
const STATUS_CSS: Record<string, string> = {
  pending:   "status-badge status-badge-pending",
  confirmed: "status-badge status-badge-confirmed",
  cancelled: "status-badge status-badge-cancelled",
};

function msToDateInput(ms: number) {
  return toDateStr(new Date(ms));
}
function dateInputToMs(s: string) {
  return new Date(s + "T00:00:00Z").getTime();
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

function buildConfirmWhatsAppUrl(
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
  const svc = serviceName ? ` ל${serviceName}` : "";
  const biz = businessName ? ` ב${businessName}` : "";
  const message = `היי ${name}! התור שלך${svc} אושר לתאריך ${dateStr} בשעה ${timeStr}${biz}. נשמח לראותך! 💖`;
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
  const svc = serviceName ? ` ל${serviceName}` : "";
  const biz = businessName ? ` ב${businessName}` : "";
  const message = `היי ${name}! לצערנו, התור שלך${svc} שהיה בתאריך ${dateStr} בשעה ${timeStr}${biz} בוטל. ניתן לקבוע תור חדש באתר. מצטערים על אי הנוחות 🙏`;
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

// ─── Hair detail labels ───────────────────────────────────────────────────────

const HAIR_LABEL: Record<string, string> = {
  hairLength:         "אורך שיער",
  hairCondition:      "מצב שיער",
  bleachHistory:      "הבהרות",
  grayHairPercentage: "שיבה",
  previousKeratin:    "קראטין קודם",
};

// ─── AppointmentCard ──────────────────────────────────────────────────────────

type AppointmentRow = {
  _id: Id<"appointments">;
  customerName: string;
  customerPhone: string;
  startTime: number;
  endTime: number;
  status: "pending" | "confirmed" | "cancelled";
  finalPrice?: number;
  notes?: string;
  service?: { name: { he: string; ar: string }; price: number; requiresHairDetails?: boolean } | null;
  barber?: { name: { he: string; ar: string } } | null;
  hairDetails?: {
    hairLength?: string;
    hairCondition?: string;
    bleachHistory?: string;
    grayHairPercentage?: string;
    previousKeratin?: string;
    currentHairColorCode?: string;
    desiredHairColorCode?: string;
    currentHairPhotoUrl?: string | null;
    desiredHairPhotoUrl?: string | null;
  } | null;
};

function AppointmentCard({
  appt,
  timezone,
  businessName,
  onConfirm,
  onCancel,
  onRestore,
}: {
  appt: AppointmentRow;
  timezone: string;
  businessName: string;
  onConfirm: () => void;
  onCancel: () => void;
  onRestore: () => void;
}) {
  const timeStr = formatSlotTime(appt.startTime, timezone, "he");
  const endStr  = formatSlotTime(appt.endTime,   timezone, "he");
  const hd = appt.hairDetails;
  const hasHairDetails = !!(
    hd && (
      hd.hairLength || hd.hairCondition || hd.bleachHistory ||
      hd.grayHairPercentage || hd.previousKeratin ||
      hd.currentHairColorCode || hd.desiredHairColorCode ||
      hd.currentHairPhotoUrl || hd.desiredHairPhotoUrl
    )
  );
  // Does this service type expect hair details at all?
  const serviceNeedsHair = appt.service
    ? needsHairDetailsStep({ name: appt.service.name, requiresHairDetails: appt.service.requiresHairDetails } as any)
    : false;

  return (
    <Card className={appt.status === "cancelled" ? "opacity-50" : ""}>
      <CardContent className="py-3 space-y-3">

        {/* ── Row 1: time + customer + actions ── */}
        <div className="flex items-start gap-3">
          <div className="text-xs font-mono text-muted-foreground w-20 shrink-0 pt-0.5">
            {timeStr}–{endStr}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{appt.customerName}</div>
            <div className="text-xs text-muted-foreground flex gap-2 flex-wrap mt-0.5">
              <span>{appt.customerPhone}</span>
              {appt.service && (
                <span>· {appt.service.name.he} ({formatPrice(appt.finalPrice ?? appt.service.price)})</span>
              )}
              {appt.barber && <span>· {appt.barber.name.he}</span>}
            </div>
            {appt.notes && (
              <div className="text-xs text-muted-foreground italic mt-0.5">{appt.notes}</div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={STATUS_CSS[appt.status]}>
              {STATUS_LABEL[appt.status]}
            </span>
            {appt.status === "pending" && (
              <button onClick={onConfirm} className="text-green-600 hover:text-green-700 transition-colors" title="אשר">
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            {appt.status === "cancelled" && (
              <button onClick={onRestore} className="text-muted-foreground hover:text-foreground transition-colors" title="שחזר">
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            {appt.status !== "cancelled" && (
              <button onClick={onCancel} className="text-muted-foreground hover:text-destructive transition-colors" title="בטל">
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Row 2: hair details (always visible when present) ── */}
        {serviceNeedsHair && !hasHairDetails && (
          <div className="border-t border-border/50 pt-2">
            <p className="text-xs text-muted-foreground italic">לא הוזנו פרטי שיער</p>
          </div>
        )}
        {hasHairDetails && hd && (
          <div className="border-t border-border/50 pt-3 space-y-3">

            {/* Text chips */}
            {(hd.hairLength || hd.hairCondition || hd.bleachHistory || hd.grayHairPercentage || hd.previousKeratin) && (
              <div className="flex flex-wrap gap-1.5">
                {(["hairLength", "hairCondition", "bleachHistory", "grayHairPercentage", "previousKeratin"] as const).map((key) =>
                  hd[key] ? (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1 border border-border/60"
                    >
                      <span className="text-muted-foreground">{HAIR_LABEL[key]}:</span>
                      <span className="font-medium">{hd[key]}</span>
                    </span>
                  ) : null
                )}
              </div>
            )}

            {/* Catalog color images */}
            {(hd.currentHairColorCode || hd.desiredHairColorCode) && (
              <div className="flex gap-3 flex-wrap">
                {([
                  ["currentHairColorCode", "צבע נוכחי"] as const,
                  ["desiredHairColorCode", "צבע רצוי"] as const,
                ]).map(([key, lbl]) => {
                  const color = getColorByCode(hd[key]);
                  if (!color) return null;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2.5 bg-muted/50 rounded-xl px-2.5 py-2 border border-border/60"
                    >
                      <img
                        src={color.imagePath}
                        alt={color.name}
                        className="w-14 h-14 rounded-lg object-cover border border-border shrink-0 shadow-sm"
                      />
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

            {/* Customer photos */}
            {(hd.currentHairPhotoUrl || hd.desiredHairPhotoUrl) && (
              <div className="flex gap-3 flex-wrap">
                {[
                  { url: hd.currentHairPhotoUrl, label: "שיער נוכחי" },
                  { url: hd.desiredHairPhotoUrl, label: "שיער רצוי" },
                ].map(({ url, label }) =>
                  url ? (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col items-center gap-1"
                    >
                      <img
                        src={url}
                        alt={label}
                        className="w-20 h-20 rounded-xl object-cover border border-border group-hover:border-primary/60 transition-colors shadow-sm"
                      />
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
  );
}

export default function AppointmentsAdminPage() {
  const businesses = useQuery(api.businesses.getAll);
  const business = businesses?.[0];

  if (!businesses) {
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
    <AdminSessionProvider slug={business._id}>
      <AppointmentsAdminInner business={business} />
    </AdminSessionProvider>
  );
}

function AppointmentsAdminInner({ business }: { business: Doc<"businesses"> }) {
  const { session } = useAdminSession();
  const router = useRouter();

  // Date range — default: past 30 days → next 30 days
  const today = new Date();
  const [fromStr, setFromStr] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return msToDateInput(d.getTime());
  });
  const [toStr, setToStr] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 30);
    return msToDateInput(d.getTime());
  });

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fromMs = dateInputToMs(fromStr);
  const toMs = dateInputToMs(toStr) + 86_400_000; // inclusive end day

  const rawAppointments = useQuery(
    api.appointments.getRange,
    business
      ? {
          businessId: business._id,
          fromMs,
          toMs,
        }
      : "skip"
  );

  const updateStatus = useMutation(api.appointments.updateAppointmentStatus);

  const appointments = useMemo(() => {
    if (!rawAppointments) return [];
    let list = rawAppointments;
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.customerName.toLowerCase().includes(q) ||
          a.customerPhone.includes(q)
      );
    }
    return list;
  }, [rawAppointments, statusFilter, search]);

  // Stats (from raw, before search/status filter)
  const stats = useMemo(() => {
    if (!rawAppointments) return { total: 0, pending: 0, confirmed: 0, cancelled: 0 };
    return rawAppointments.reduce(
      (acc, a) => {
        acc.total++;
        acc[a.status as keyof typeof acc]++;
        return acc;
      },
      { total: 0, pending: 0, confirmed: 0, cancelled: 0 }
    );
  }, [rawAppointments]);

  // Group by date
  const byDate = useMemo(() => {
    const map: Record<string, typeof appointments> = {};
    for (const a of appointments) {
      const d = toDateStr(new Date(a.startTime));
      (map[d] ??= []).push(a);
    }
    return map;
  }, [appointments]);

  const dates = Object.keys(byDate).sort();

  const timezone = business?.timezone ?? "UTC";

  useEffect(() => {
    if (!session || session.businessId !== business._id) {
      router.replace("/admin");
    }
  }, [session, business._id, router]);

  if (!session || session.businessId !== business._id) {
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
          <h1 className="text-lg font-bold tracking-tight">ניהול תורים</h1>
          <a
            href="/admin"
            className="glass-badge text-xs font-medium text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5"
          >
            ← חזרה לניהול
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Stats */}
        {rawAppointments && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "סה״כ",    value: stats.total,     cls: "" },
              { label: "ממתינים", value: stats.pending,   cls: "text-amber-600" },
              { label: "מאושרים", value: stats.confirmed, cls: "text-green-600" },
              { label: "בוטלו",   value: stats.cancelled, cls: "text-destructive" },
            ].map(({ label, value, cls }) => (
              <Card key={label}>
                <CardContent className="py-3 text-center">
                  <div className={`text-2xl font-bold ${cls}`}>{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">מתאריך</Label>
                <Input
                  type="date"
                  value={fromStr}
                  onChange={(e) => setFromStr(e.target.value)}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">עד תאריך</Label>
                <Input
                  type="date"
                  value={toStr}
                  onChange={(e) => setToStr(e.target.value)}
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">חיפוש לקוח</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="שם או טלפון..."
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {/* Status filter */}
              {["all", "pending", "confirmed", "cancelled"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 h-8 rounded-full text-xs font-medium transition-all duration-200 ${
                    statusFilter === s
                      ? s === "all"
                        ? "btn-glass-primary"
                        : STATUS_CSS[s]
                      : "glass-badge text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "all" ? "הכל" : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* List */}
        {!rawAppointments && (
          <div className="text-center text-muted-foreground py-8 text-sm">טוען...</div>
        )}

        {rawAppointments && dates.length === 0 && (
          <div className="text-center text-muted-foreground py-12 text-sm">
            אין תורים בטווח זה
          </div>
        )}

        {dates.map((dateStr) => {
          const d = new Date(dateStr + "T00:00:00Z");
          const dayName = DAY_NAMES[d.getUTCDay()];
          const display = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
          const isToday = dateStr === toDateStr(today);
          const isPast = dateInputToMs(dateStr) < today.setUTCHours(0,0,0,0);

          return (
            <div key={dateStr}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm font-semibold ${isPast ? "text-muted-foreground" : ""}`}>
                  {dayName}, {display}
                </span>
                {isToday && <span className="status-badge status-badge-confirmed">היום</span>}
                <span className="text-xs text-muted-foreground">
                  ({byDate[dateStr].length} תורים)
                </span>
              </div>

              <div className="space-y-2">
                {byDate[dateStr].map((appt) => (
                  <AppointmentCard
                    key={appt._id}
                    appt={appt}
                    timezone={timezone}
                    businessName={business?.name?.he ?? ""}
                    onConfirm={async () => {
                      await updateStatus({ appointmentId: appt._id, status: "confirmed", token: session.token });
                      const url = buildConfirmWhatsAppUrl(
                        appt.customerPhone, appt.customerName, appt.startTime, timezone,
                        appt.service?.name?.he ?? "", business?.name?.he ?? "",
                      );
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    onCancel={async () => {
                      await updateStatus({ appointmentId: appt._id, status: "cancelled", token: session.token });
                      const url = buildCancelWhatsAppUrl(
                        appt.customerPhone, appt.customerName, appt.startTime, timezone,
                        appt.service?.name?.he ?? "", business?.name?.he ?? "",
                      );
                      window.open(url, "_blank", "noopener,noreferrer");
                      const serviceName = appt.service?.name?.he ?? "תור";
                      const bizName = business?.name?.he ?? "";
                      downloadICS({
                        uid: `nextinline-${appt._id}`,
                        startTime: appt.startTime,
                        endTime: appt.endTime,
                        summary: `ביטול: ${serviceName}${bizName ? ` ב${bizName}` : ""}`,
                        cancelled: true,
                        sequence: 2,
                      }, "ביטול-תור.ics");
                    }}
                    onRestore={() => updateStatus({ appointmentId: appt._id, status: "pending", token: session.token })}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
