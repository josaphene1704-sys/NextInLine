/**
 * Pure, side-effect-free utilities shared across Convex modules.
 * No imports from "_generated/" — safe to import from any Convex file.
 */

// ─── Working hours normalization ─────────────────────────────────────────────

export interface DaySchedule {
  day: number;   // 0 = Sunday … 6 = Saturday
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface WorkingHours {
  daySchedules?: DaySchedule[];
  days?: number[];
  start?: string;
  end?: string;
  slotIntervalMinutes?: number;
}

/**
 * Normalise any working-hours shape into a flat per-day array.
 * When `daySchedules` is present it takes precedence; otherwise the legacy
 * flat `days / start / end` fields are converted.
 */
export function normalizeDaySchedules(wh: WorkingHours): DaySchedule[] {
  if (wh.daySchedules && wh.daySchedules.length > 0) return wh.daySchedules;
  return (wh.days ?? []).map((day) => ({
    day,
    start: wh.start ?? "09:00",
    end: wh.end ?? "19:00",
  }));
}

// ─────────────────────────────────────────────────────────────────────────────

export interface TimeSlot {
  startTime: number; // Unix ms (UTC)
  endTime: number;   // Unix ms (UTC)
  label: string;     // "HH:MM" in UTC — client localises for display
}

export interface BookedWindow {
  startTime: number;
  endTime: number;
}

// ─── Time helpers ────────────────────────────────────────────────────────────

/** Convert "HH:MM" to total minutes from midnight. */
export function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Build an array of available booking slots for a single day.
 *
 * Algorithm:
 *  1. Walk from `workingStart` to `workingEnd` in `slotIntervalMin` steps.
 *  2. For each candidate slot [start, start + serviceDuration]:
 *     a. Discard if the slot has already started (compared to `nowMs`).
 *     b. Discard if it overlaps with any entry in `bookedWindows`.
 *  3. Return surviving slots.
 *
 * Overlap condition: two intervals [a,b) and [c,d) overlap iff a < d && b > c.
 *
 * @param dateStr          "YYYY-MM-DD" — interpreted as UTC midnight.
 * @param workingStart     "HH:MM" 24-hour, UTC.
 * @param workingEnd       "HH:MM" 24-hour, UTC.
 * @param serviceDurationMin  Duration of the service in minutes.
 * @param slotIntervalMin  Granularity between candidate slot starts (e.g. 30).
 * @param bookedWindows    Non-cancelled existing appointments for the barber that day.
 * @param nowMs            Current time in ms (injectable for testability).
 */
export function generateAvailableSlots(
  dateStr: string,
  workingStart: string,
  workingEnd: string,
  serviceDurationMin: number,
  slotIntervalMin: number,
  bookedWindows: BookedWindow[],
  nowMs: number = Date.now()
): TimeSlot[] {
  const [year, month, day] = dateStr.split("-").map(Number);

  const dayStartMs = Date.UTC(year, month - 1, day); // midnight UTC

  const workingStartMs = dayStartMs + timeStringToMinutes(workingStart) * 60_000;
  const workingEndMs   = dayStartMs + timeStringToMinutes(workingEnd)   * 60_000;
  const durationMs     = serviceDurationMin * 60_000;
  const intervalMs     = slotIntervalMin    * 60_000;

  const slots: TimeSlot[] = [];

  for (
    let slotStart = workingStartMs;
    slotStart + durationMs <= workingEndMs;
    slotStart += intervalMs
  ) {
    // Skip slots that have already passed.
    if (slotStart <= nowMs) continue;

    const slotEnd = slotStart + durationMs;

    const isBooked = bookedWindows.some(
      (w) => w.startTime < slotEnd && w.endTime > slotStart
    );

    if (!isBooked) {
      const d = new Date(slotStart);
      const hh = d.getUTCHours().toString().padStart(2, "0");
      const mm = d.getUTCMinutes().toString().padStart(2, "0");
      slots.push({ startTime: slotStart, endTime: slotEnd, label: `${hh}:${mm}` });
    }
  }

  return slots;
}

/**
 * Returns true when `dayOfWeek` (0 = Sunday … 6 = Saturday, UTC)
 * is included in the business/barber working days array.
 */
export function isWorkingDay(days: number[], utcDate: Date): boolean {
  return days.includes(utcDate.getUTCDay());
}

/** Derive the UTC day start/end timestamps for a "YYYY-MM-DD" string. */
export function dayBoundsFromDateStr(dateStr: string): {
  dayStartMs: number;
  dayEndMs: number;
} {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dayStartMs = Date.UTC(year, month - 1, day);
  return { dayStartMs, dayEndMs: dayStartMs + 86_400_000 };
}

/** Validate phone: 7–15 digits, optional leading +, spaces, dashes, parens.
 *  "1234" is accepted as a test bypass so bookings can be verified easily. */
export function isValidPhone(phone: string): boolean {
  const t = phone.trim();
  if (t === "1234") return true;
  return /^\+?[\d\s\-()+]{7,15}$/.test(t);
}
