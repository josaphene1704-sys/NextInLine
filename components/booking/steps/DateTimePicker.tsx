"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/contexts/LanguageContext";
import { cn, toDateStr, formatSlotTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, ClipboardList } from "lucide-react";
import { WaitingListModal } from "@/components/booking/WaitingListModal";

interface TimeSlot {
  startTime: number;
  endTime: number;
  label: string;
}

interface Props {
  businessId: Id<"businesses">;
  barberId: Id<"barbers">;
  serviceId: Id<"services">;
  selectedDate: string | null;
  selectedSlot: TimeSlot | null;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slot: TimeSlot) => void;
  onBack: () => void;
}

const DAY_HEADERS_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const DAY_HEADERS_AR = ["أح", "إث", "ثل", "أر", "خم", "جم", "سب"];
const MONTHS_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const labels = {
  title:            { he: "בחרי תאריך ושעה",                ar: "اختاري التاريخ والوقت" },
  subtitle:         { he: "מתי תרצי להגיע?",                ar: "متى تودين الحضور؟" },
  back:             { he: "חזור",                            ar: "رجوع" },
  availableSlots:   { he: "שעות פנויות",                    ar: "المواعيد المتاحة" },
  noSlots:          { he: "אין שעות פנויות ביום זה",        ar: "لا توجد مواعيد في هذا اليوم" },
  notWorking:       { he: "יום מנוחה",                      ar: "يوم إجازة" },
  loading:          { he: "טוען שעות...",                   ar: "جاري تحميل المواعيد..." },
  taken:            { he: "תפוס",                            ar: "محجوز" },
  selectDate:       { he: "בחרי תאריך מהלוח",               ar: "اختاري تاريخاً من التقويم" },
  waitingListCta:   { he: "הצטרפי לרשימת המתנה ליום זה",   ar: "انضمي إلى قائمة الانتظار لهذا اليوم" },
  waitingListDesc:  { he: "נעדכן אותך ברגע שיפתח מקום פנוי", ar: "سنُعلمك فور توفر موعد" },
  waitingListLink:  { he: "לא מצאת שעה מתאימה? הצטרפי לרשימת המתנה", ar: "لم تجدي موعدًا مناسبًا؟ انضمي لقائمة الانتظار" },
};

/** Returns an array of cells for the calendar grid; null = empty leading cell */
function buildCalendarCells(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  // Fill leading nulls so the 1st falls on the correct weekday column (Sun=0)
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

export default function DateTimePicker({
  businessId,
  barberId,
  serviceId,
  selectedDate,
  selectedSlot,
  onSelectDate,
  onSelectSlot,
  onBack,
}: Props) {
  const { lang, t } = useLang();

  const [waitingListOpen, setWaitingListOpen] = useState(false);

  // Calendar month state (first day of the displayed month)
  const [calMonth, setCalMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const slotsResult = useQuery(
    api.appointments.getAvailableSlots,
    selectedDate ? { barberId, serviceId, date: selectedDate } : "skip"
  );

  const timezone = slotsResult?.timezone ?? "Asia/Jerusalem";

  // Boundaries: today and 60 days from now
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 60);

  const cells = buildCalendarCells(calMonth.getFullYear(), calMonth.getMonth());

  const prevMonth = () => {
    const d = new Date(calMonth);
    d.setMonth(d.getMonth() - 1);
    // Don't go before current month
    const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0);
    if (d >= thisMonth) setCalMonth(d);
  };
  const nextMonth = () => {
    const d = new Date(calMonth);
    d.setMonth(d.getMonth() + 1);
    // Don't go more than 2 months ahead
    const limit = new Date(today); limit.setMonth(limit.getMonth() + 2); limit.setDate(1);
    if (d < limit) setCalMonth(d);
  };

  const dayHeaders = lang === "ar" ? DAY_HEADERS_AR : DAY_HEADERS_HE;
  const monthName  = lang === "ar"
    ? MONTHS_AR[calMonth.getMonth()]
    : MONTHS_HE[calMonth.getMonth()];

  return (
    <div>
      <div className="text-center mb-7">
        <h2 className="text-2xl font-bold">{t(labels.title)}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t(labels.subtitle)}</p>
      </div>

      {/* ── Calendar ── */}
      <div className="glass rounded-2xl p-4 mb-6">
        {/* Month header — in RTL, first child is visually on the right */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
            title="חודש הבא"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold">
            {monthName} {calMonth.getFullYear()}
          </span>
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
            title="חודש קודם"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {dayHeaders.map((d) => (
            <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((cell, idx) => {
            if (!cell) return <div key={`empty-${idx}`} />;

            const dateStr  = toDateStr(cell);
            const isPast   = cell < today;
            const isFuture = cell > maxDate;
            const isDisabled = isPast || isFuture;
            const isToday    = dateStr === toDateStr(today);
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={dateStr}
                disabled={isDisabled}
                onClick={() => onSelectDate(dateStr)}
                className={cn(
                  "relative mx-auto w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all duration-150",
                  isSelected && "bg-primary text-primary-foreground font-bold shadow-sm",
                  !isSelected && isToday && "border border-primary text-primary font-semibold",
                  !isSelected && !isToday && !isDisabled && "hover:bg-muted/60 font-medium",
                  isDisabled && "text-muted-foreground/40 cursor-not-allowed",
                )}
              >
                {cell.getDate()}
                {isToday && !isSelected && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Time slots ── */}
      {selectedDate && (
        <div className="mb-6">
          <p className="text-sm font-medium text-muted-foreground mb-3">{t(labels.availableSlots)}</p>

          {slotsResult === undefined && (
            <p className="text-center text-muted-foreground py-8 animate-pulse">{t(labels.loading)}</p>
          )}

          {slotsResult && !slotsResult.isWorkingDay && (
            <div className="text-center text-muted-foreground py-8 glass rounded-2xl">
              {t(labels.notWorking)}
            </div>
          )}

          {/* No slots at all — show message + waiting list CTA */}
          {slotsResult?.isWorkingDay && slotsResult.slots.length === 0 && selectedDate && (
            <div className="space-y-3">
              <div className="text-center text-muted-foreground py-6 glass rounded-2xl">
                {t(labels.noSlots)}
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                <ClipboardList className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary">{t(labels.waitingListCta)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t(labels.waitingListDesc)}</p>
                  <button
                    onClick={() => setWaitingListOpen(true)}
                    className="mt-3 w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium py-2 hover:bg-primary/90 transition-colors"
                  >
                    {t(labels.waitingListCta)}
                  </button>
                </div>
              </div>
            </div>
          )}

          {slotsResult?.isWorkingDay &&
            (slotsResult.slots.length > 0 || (slotsResult.bookedSlots ?? []).length > 0) && (() => {
              // Merge and sort all slots by startTime
              const booked = (slotsResult.bookedSlots ?? []).map((s) => ({ ...s, taken: true }));
              const avail  = slotsResult.slots.map((s) => ({ ...s, taken: false }));
              const all = [...avail, ...booked].sort((a, b) => a.startTime - b.startTime);

              const hasBooked = booked.length > 0;
              return (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {all.map((slot) => {
                      const isSelected = selectedSlot?.startTime === slot.startTime;
                      if (slot.taken) {
                        return (
                          <div
                            key={slot.startTime}
                            className="slot-btn flex flex-col items-center justify-center gap-0.5 opacity-50 cursor-not-allowed bg-muted/40 border border-border/40"
                          >
                            <span className="text-xs font-medium text-muted-foreground">
                              {formatSlotTime(slot.startTime, timezone, lang)}
                            </span>
                            <span className="text-[10px] text-muted-foreground/70">
                              {t(labels.taken)}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <button
                          key={slot.startTime}
                          onClick={() => onSelectSlot(slot)}
                          className={cn("slot-btn", isSelected ? "slot-selected" : "slot-available")}
                        >
                          {formatSlotTime(slot.startTime, timezone, lang)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Secondary waiting-list link — always visible when any slots are taken */}
                  {hasBooked && selectedDate && (
                    <button
                      onClick={() => setWaitingListOpen(true)}
                      className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-border/60 py-2.5 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      {t(labels.waitingListLink)}
                    </button>
                  )}
                </>
              );
            })()}
        </div>
      )}

      {!selectedDate && (
        <p className="text-center text-sm text-muted-foreground py-4">{t(labels.selectDate)}</p>
      )}

      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ChevronRight className="w-4 h-4" />
        {t(labels.back)}
      </Button>

      {waitingListOpen && selectedDate && (
        <WaitingListModal
          businessId={businessId}
          barberId={barberId}
          serviceId={serviceId}
          date={selectedDate}
          onClose={() => setWaitingListOpen(false)}
          onSuccess={() => setWaitingListOpen(false)}
        />
      )}
    </div>
  );
}
