"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export interface DayScheduleItem {
  day: number;   // 0–6
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

interface Props {
  schedules: DayScheduleItem[];
  interval: number;
  onChange: (schedules: DayScheduleItem[], interval: number) => void;
}

export function WorkingHoursEditor({ schedules, interval, onChange }: Props) {
  function isActive(day: number) {
    return schedules.some((s) => s.day === day);
  }

  function getSchedule(day: number): DayScheduleItem {
    return schedules.find((s) => s.day === day) ?? { day, start: "09:00", end: "17:00" };
  }

  function toggleDay(day: number) {
    if (isActive(day)) {
      onChange(schedules.filter((s) => s.day !== day), interval);
    } else {
      const next = [...schedules, getSchedule(day)].sort((a, b) => a.day - b.day);
      onChange(next, interval);
    }
  }

  function setTime(day: number, field: "start" | "end", value: string) {
    onChange(
      schedules.map((s) => (s.day === day ? { ...s, [field]: value } : s)),
      interval
    );
  }

  return (
    <div className="space-y-1.5">
      {Array.from({ length: 7 }, (_, i) => {
        const active = isActive(i);
        const sched = getSchedule(i);
        return (
          <div key={i} className="flex items-center gap-3 py-0.5">
            <button
              type="button"
              onClick={() => toggleDay(i)}
              className={cn(
                "w-[4.5rem] h-8 rounded border text-xs font-medium transition-colors shrink-0",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary"
              )}
            >
              {DAY_NAMES[i]}
            </button>

            {active ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={sched.start}
                  onChange={(e) => setTime(i, "start", e.target.value)}
                  dir="ltr"
                  className="h-8 w-[6.5rem] text-left text-sm px-2"
                />
                <span className="text-muted-foreground text-xs">—</span>
                <Input
                  type="time"
                  value={sched.end}
                  onChange={(e) => setTime(i, "end", e.target.value)}
                  dir="ltr"
                  className="h-8 w-[6.5rem] text-left text-sm px-2"
                />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">סגור</span>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-2 pt-3 border-t mt-2">
        <span className="text-xs text-muted-foreground shrink-0">מרווח בין תורים:</span>
        <Input
          type="number"
          value={interval}
          onChange={(e) => onChange(schedules, Number(e.target.value))}
          min={5}
          step={5}
          dir="ltr"
          className="h-8 w-20 text-left text-sm px-2"
        />
        <span className="text-xs text-muted-foreground">דקות</span>
      </div>
    </div>
  );
}

/** Convert legacy flat workingHours to per-day schedule array. */
export function legacyToSchedules(wh: {
  daySchedules?: DayScheduleItem[];
  days?: number[];
  start?: string;
  end?: string;
}): DayScheduleItem[] {
  if (wh.daySchedules && wh.daySchedules.length > 0) return wh.daySchedules;
  return (wh.days ?? []).map((day) => ({
    day,
    start: wh.start ?? "09:00",
    end: wh.end ?? "19:00",
  }));
}
