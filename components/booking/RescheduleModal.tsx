"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/contexts/LanguageContext";
import { cn, formatSlotTime, toDateStr } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, CalendarClock, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_HE = ["ינו׳","פבר׳","מרץ","אפר׳","מאי","יוני","יולי","אוג׳","ספט׳","אוק׳","נוב׳","דצמ׳"];
const DAY_HEADERS = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];

interface TimeSlot { startTime: number; endTime: number; label: string; }

function buildCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= last; d++) cells.push(new Date(year, month, d));
  return cells;
}

// ─── Slot + calendar picker ───────────────────────────────────────────────────

function ReschedulePicker({
  barberId,
  serviceId,
  timezone,
  onConfirm,
  loading,
}: {
  barberId: Id<"barbers">;
  serviceId: Id<"services">;
  timezone: string;
  onConfirm: (slot: TimeSlot) => void;
  loading: boolean;
}) {
  const { lang } = useLang();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setDate(today.getDate() + 60);

  const [calMonth, setCalMonth] = useState<Date>(() => {
    const d = new Date(today); d.setDate(1); return d;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const slotsResult = useQuery(
    api.appointments.getAvailableSlots,
    selectedDate ? { barberId, serviceId, date: selectedDate } : "skip"
  );

  const cells = buildCells(calMonth.getFullYear(), calMonth.getMonth());

  const prevMonth = () => {
    const d = new Date(calMonth); d.setMonth(d.getMonth() - 1);
    const min = new Date(today); min.setDate(1);
    if (d >= min) setCalMonth(d);
  };
  const nextMonth = () => {
    const d = new Date(calMonth); d.setMonth(d.getMonth() + 1);
    const lim = new Date(today); lim.setMonth(lim.getMonth() + 2); lim.setDate(1);
    if (d < lim) setCalMonth(d);
  };

  const available = slotsResult?.slots ?? [];
  const booked    = slotsResult?.bookedSlots ?? [];
  const allSlots  = [
    ...available.map(s => ({ ...s, taken: false as const })),
    ...booked.map(s =>    ({ ...s, taken: true  as const })),
  ].sort((a, b) => a.startTime - b.startTime);

  return (
    <div className="space-y-4">
      {/* Calendar */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold">
            {MONTHS_HE[calMonth.getMonth()]} {calMonth.getFullYear()}
          </span>
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map(h => (
            <div key={h} className="text-center text-[11px] font-medium text-muted-foreground py-1">{h}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((cell, idx) => {
            if (!cell) return <div key={`e-${idx}`} />;
            const ds       = toDateStr(cell);
            const disabled = cell < today || cell > maxDate;
            const isToday  = ds === toDateStr(today);
            const isSel    = ds === selectedDate;
            return (
              <button
                key={ds}
                disabled={disabled}
                onClick={() => { setSelectedDate(ds); setSelectedSlot(null); }}
                className={cn(
                  "mx-auto w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all",
                  isSel    && "bg-primary text-primary-foreground font-bold shadow-sm",
                  !isSel && isToday && "border border-primary text-primary font-semibold",
                  !isSel && !isToday && !disabled && "hover:bg-muted/60 font-medium",
                  disabled && "text-muted-foreground/40 cursor-not-allowed",
                )}
              >
                {cell.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      {selectedDate && (
        <div>
          {slotsResult === undefined && (
            <p className="text-center text-sm text-muted-foreground animate-pulse py-4">טוען שעות...</p>
          )}
          {slotsResult && !slotsResult.isWorkingDay && (
            <p className="text-center text-sm text-muted-foreground py-4">יום מנוחה</p>
          )}
          {slotsResult?.isWorkingDay && allSlots.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">אין שעות פנויות ביום זה</p>
          )}
          {slotsResult?.isWorkingDay && allSlots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {allSlots.map(slot => {
                if (slot.taken) {
                  return (
                    <div key={slot.startTime} className="slot-btn flex flex-col items-center gap-0.5 opacity-40 cursor-not-allowed bg-muted/40 border border-border/40">
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatSlotTime(slot.startTime, timezone, lang)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70">תפוס</span>
                    </div>
                  );
                }
                const isSel = selectedSlot?.startTime === slot.startTime;
                return (
                  <button
                    key={slot.startTime}
                    onClick={() => setSelectedSlot(slot)}
                    className={cn("slot-btn", isSel ? "slot-selected" : "slot-available")}
                  >
                    {formatSlotTime(slot.startTime, timezone, lang)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedSlot && (
        <Button className="w-full" disabled={loading} onClick={() => onConfirm(selectedSlot)}>
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />מעדכן...</>
            : `אשר מועד — ${formatSlotTime(selectedSlot.startTime, timezone, lang)}`}
        </Button>
      )}
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

export interface RescheduleAppt {
  _id: Id<"appointments">;
  startTime: number;
  barberId: Id<"barbers">;
  serviceId: Id<"services">;
  barber?: { _id: Id<"barbers"> } | null;
  service?: { _id: Id<"services">; name: { he: string; ar?: string } } | null;
  business?: { timezone?: string } | null;
}

export function RescheduleModal({
  appt,
  timezone,
  onClose,
  onSuccess,
}: {
  appt: RescheduleAppt;
  timezone: string;
  onClose: () => void;
  /** Called with the new startTime after a successful reschedule */
  onSuccess?: (newStartTime: number) => void;
}) {
  const reschedule = useMutation(api.appointments.rescheduleAppointment);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  const barberId  = (appt.barber?._id  ?? appt.barberId)  as Id<"barbers">;
  const serviceId = (appt.service?._id ?? appt.serviceId) as Id<"services">;

  async function handleConfirm(slot: TimeSlot) {
    setError(null);
    setLoading(true);
    try {
      await reschedule({ appointmentId: appt._id, startTime: slot.startTime });
      onSuccess?.(slot.startTime);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90dvh] overflow-y-auto"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background z-10">
          <h2 className="font-bold text-base flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            שינוי מועד
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Current appointment summary */}
          <div className="glass rounded-xl px-4 py-3 text-sm space-y-0.5">
            <p className="text-muted-foreground text-xs">מועד נוכחי</p>
            <p className="font-medium">{appt.service?.name?.he ?? "שירות"}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(appt.startTime).toLocaleDateString("he-IL", {
                weekday: "short", day: "numeric", month: "long", timeZone: timezone,
              })}{" · "}{formatSlotTime(appt.startTime, timezone, "he")}
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2.5">{error}</p>
          )}

          <ReschedulePicker
            barberId={barberId}
            serviceId={serviceId}
            timezone={timezone}
            onConfirm={handleConfirm}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
