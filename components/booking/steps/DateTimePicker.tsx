"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useLang } from "@/contexts/LanguageContext";
import { cn, toDateStr, formatSlotTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface TimeSlot {
  startTime: number;
  endTime: number;
  label: string;
}

interface Props {
  barberId: Id<"barbers">;
  serviceId: Id<"services">;
  selectedDate: string | null;
  selectedSlot: TimeSlot | null;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slot: TimeSlot) => void;
  onBack: () => void;
}

function getNext14Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

const labels = {
  title: { he: "בחרי תאריך ושעה", ar: "اختاري التاريخ والوقت" },
  subtitle: { he: "מתי תרצי להגיע?", ar: "متى تودين الحضور؟" },
  back: { he: "חזור", ar: "رجوع" },
  chooseDate: { he: "בחרי תאריך", ar: "اختاري التاريخ" },
  availableSlots: { he: "שעות פנויות", ar: "المواعيد المتاحة" },
  noSlots: { he: "אין שעות פנויות ביום זה", ar: "لا توجد مواعيد في هذا اليوم" },
  notWorking: { he: "יום מנוחה", ar: "يوم إجازة" },
  loading: { he: "טוען שעות...", ar: "جاري تحميل المواعيد..." },
};

export default function DateTimePicker({
  barberId,
  serviceId,
  selectedDate,
  selectedSlot,
  onSelectDate,
  onSelectSlot,
  onBack,
}: Props) {
  const { lang, t } = useLang();
  const locale = lang === "ar" ? "ar-IL" : "he-IL";

  const slotsResult = useQuery(
    api.appointments.getAvailableSlots,
    selectedDate ? { barberId, serviceId, date: selectedDate } : "skip"
  );

  const timezone = slotsResult?.timezone ?? "Asia/Jerusalem";

  const days = getNext14Days();

  return (
    <div>
      <div className="text-center mb-7">
        <h2 className="text-2xl font-bold">{t(labels.title)}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t(labels.subtitle)}</p>
      </div>

      {/* Date chips */}
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground mb-3">{t(labels.chooseDate)}</p>
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
          {days.map((d) => {
            const dateStr = toDateStr(d);
            const isSelected = selectedDate === dateStr;
            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 border-2 min-w-[58px] shrink-0 transition-all duration-200 snap-start",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card hover:border-primary/60"
                )}
              >
                <span className="text-xs font-medium">
                  {d.toLocaleDateString(locale, { weekday: "short" })}
                </span>
                <span className="text-lg font-bold leading-none">{d.getDate()}</span>
                <span className="text-xs">
                  {d.toLocaleDateString(locale, { month: "short" })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className="mb-6">
          <p className="text-sm font-medium text-muted-foreground mb-3">{t(labels.availableSlots)}</p>

          {slotsResult === undefined && (
            <p className="text-center text-muted-foreground py-8 animate-pulse">{t(labels.loading)}</p>
          )}

          {slotsResult && !slotsResult.isWorkingDay && (
            <div className="text-center text-muted-foreground py-8 bg-muted/50 rounded-2xl">
              {t(labels.notWorking)}
            </div>
          )}

          {slotsResult?.isWorkingDay && slotsResult.slots.length === 0 && (
            <div className="text-center text-muted-foreground py-8 bg-muted/50 rounded-2xl">
              {t(labels.noSlots)}
            </div>
          )}

          {slotsResult?.isWorkingDay && slotsResult.slots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slotsResult.slots.map((slot) => {
                const isSelected = selectedSlot?.startTime === slot.startTime;
                return (
                  <button
                    key={slot.startTime}
                    onClick={() => onSelectSlot(slot)}
                    className={cn(
                      "rounded-xl border-2 py-2.5 text-sm font-semibold transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card hover:border-primary/60 hover:bg-accent/30"
                    )}
                  >
                    {formatSlotTime(slot.startTime, timezone, lang)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ChevronRight className="w-4 h-4" />
        {t(labels.back)}
      </Button>
    </div>
  );
}
