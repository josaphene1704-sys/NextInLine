"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatPrice, formatSlotTime, toDateStr } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const STATUS_LABEL: Record<string, string> = {
  pending: "ממתין",
  confirmed: "מאושר",
  cancelled: "בוטל",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  cancelled: "destructive",
};

function msToDateInput(ms: number) {
  return toDateStr(new Date(ms));
}
function dateInputToMs(s: string) {
  return new Date(s + "T00:00:00Z").getTime();
}

export default function AppointmentsAdminPage() {
  const businesses = useQuery(api.businesses.getAll);
  const business = businesses?.[0];

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

  const [selectedBarber, setSelectedBarber] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const barbers = useQuery(
    api.barbers.getAllByBusiness,
    business ? { businessId: business._id } : "skip"
  );

  const fromMs = dateInputToMs(fromStr);
  const toMs = dateInputToMs(toStr) + 86_400_000; // inclusive end day

  const rawAppointments = useQuery(
    api.appointments.getRange,
    business
      ? {
          businessId: business._id,
          fromMs,
          toMs,
          barberId: selectedBarber ? (selectedBarber as Id<"barbers">) : undefined,
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

  if (!businesses) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        טוען...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30" dir="rtl">
      <header className="bg-card border-b px-6 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">ניהול תורים</h1>
          <a
            href="/admin"
            className="text-xs font-medium text-muted-foreground hover:text-foreground border border-border/60 rounded-full px-3 py-1.5 transition-colors"
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
              {/* Barber filter */}
              <select
                value={selectedBarber}
                onChange={(e) => setSelectedBarber(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="">כל הספרים</option>
                {barbers?.map((b) => (
                  <option key={b._id} value={b._id}>{b.name.he}</option>
                ))}
              </select>

              {/* Status filter */}
              {["all", "pending", "confirmed", "cancelled"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 h-8 rounded-full border text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary"
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
                {isToday && <Badge variant="default" className="text-xs py-0">היום</Badge>}
                <span className="text-xs text-muted-foreground">
                  ({byDate[dateStr].length} תורים)
                </span>
              </div>

              <div className="space-y-2">
                {byDate[dateStr].map((appt) => {
                  const timeStr = formatSlotTime(appt.startTime, timezone, "he");
                  const endStr  = formatSlotTime(appt.endTime,   timezone, "he");
                  return (
                    <Card
                      key={appt._id}
                      className={appt.status === "cancelled" ? "opacity-50" : ""}
                    >
                      <CardContent className="py-3 flex items-center gap-3">
                        <div className="text-xs font-mono text-muted-foreground w-20 shrink-0">
                          {timeStr}–{endStr}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{appt.customerName}</div>
                          <div className="text-xs text-muted-foreground flex gap-2 flex-wrap mt-0.5">
                            <span>{appt.customerPhone}</span>
                            {appt.service && (
                              <span>· {appt.service.name.he} ({formatPrice(appt.service.price)})</span>
                            )}
                            {appt.barber && <span>· {appt.barber.name.he}</span>}
                          </div>
                          {appt.notes && (
                            <div className="text-xs text-muted-foreground italic mt-0.5">
                              {appt.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant={STATUS_VARIANT[appt.status]} className="text-xs">
                            {STATUS_LABEL[appt.status]}
                          </Badge>
                          {appt.status === "pending" && (
                            <button
                              onClick={() => updateStatus({ appointmentId: appt._id, status: "confirmed" })}
                              className="text-green-600 hover:text-green-700 transition-colors"
                              title="אשר"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          {appt.status === "cancelled" && (
                            <button
                              onClick={() => updateStatus({ appointmentId: appt._id, status: "pending" })}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="שחזר"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          {appt.status !== "cancelled" && (
                            <button
                              onClick={() => updateStatus({ appointmentId: appt._id, status: "cancelled" })}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title="בטל"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
