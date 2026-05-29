"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatPrice, formatSlotTime, toDateStr } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

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

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function AppointmentsCalendar({
  businessId,
  timezone,
}: {
  businessId: Id<"businesses">;
  timezone: string;
}) {
  const barbers = useQuery(api.barbers.getAllByBusiness, { businessId });
  const [selectedBarber, setSelectedBarber] = useState<string>(""); // "" = all

  const fromMs = new Date().setUTCHours(0, 0, 0, 0);

  const appointments = useQuery(api.appointments.getUpcoming, {
    businessId,
    fromMs,
    barberId: selectedBarber ? (selectedBarber as Id<"barbers">) : undefined,
  });

  const updateStatus = useMutation(api.appointments.updateAppointmentStatus);

  if (!barbers || !appointments) {
    return <div className="text-muted-foreground text-sm">טוען תורים...</div>;
  }

  // Group by date string
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
        <span className="text-sm text-muted-foreground shrink-0">ספר:</span>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedBarber("")}
            className={`px-3 h-8 rounded-full border text-xs font-medium transition-colors ${
              selectedBarber === ""
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary"
            }`}
          >
            כולם
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
              {byDate[dateStr].map((appt) => {
                const timeStr = formatSlotTime(appt.startTime, timezone, "he");
                const endStr = formatSlotTime(appt.endTime, timezone, "he");
                return (
                  <Card
                    key={appt._id}
                    className={appt.status === "cancelled" ? "opacity-50" : ""}
                  >
                    <CardContent className="py-3 flex items-center gap-3">
                      <div className="text-xs font-mono text-muted-foreground shrink-0 w-20">
                        {timeStr}–{endStr}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {appt.customerName}
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                          <span>{appt.customerPhone}</span>
                          {appt.service && (
                            <span>
                              · {appt.service.name.he} ({formatPrice(appt.service.price)})
                            </span>
                          )}
                          {appt.barber && (
                            <span>· {appt.barber.name.he}</span>
                          )}
                        </div>
                        {appt.notes && (
                          <div className="text-xs text-muted-foreground mt-0.5 italic">
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
                            onClick={() =>
                              updateStatus({
                                appointmentId: appt._id,
                                status: "confirmed",
                              })
                            }
                            className="text-green-600 hover:text-green-700 transition-colors"
                            title="אשר"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        {appt.status !== "cancelled" && (
                          <button
                            onClick={() =>
                              updateStatus({
                                appointmentId: appt._id,
                                status: "cancelled",
                              })
                            }
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
    </div>
  );
}
