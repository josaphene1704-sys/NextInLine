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
  startTime: number; // Unix ms — the real instant the slot starts
  endTime: number;   // Unix ms — the real instant the slot ends
  label: string;     // "HH:MM" wall-clock time in the business timezone
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

// ─── Timezone conversion ─────────────────────────────────────────────────────
// Business working hours are wall-clock times in the business's IANA timezone
// (e.g. "Asia/Jerusalem"). These helpers convert such wall times to real UTC
// instants, DST included, using Intl (available in the Convex runtime).

/** Offset (ms) of `timeZone` from UTC at the given UTC instant. */
function tzOffsetAt(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcMs));

  const p: Record<string, number> = {};
  for (const { type, value } of parts) {
    if (type !== "literal") p[type] = Number(value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - utcMs;
}

/**
 * Convert a wall-clock time (`minutesFromMidnight`) on `dateStr` ("YYYY-MM-DD")
 * in `timeZone` to a UTC ms instant. E.g. ("2026-07-10", 540, "Asia/Jerusalem")
 * → the instant of 09:00 IDT = 06:00 UTC.
 */
export function zonedTimeToUtcMs(
  dateStr: string,
  minutesFromMidnight: number,
  timeZone: string
): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const wallUtc = Date.UTC(y, mo - 1, d) + minutesFromMidnight * 60_000;
  // First guess uses the offset at the wall time read as UTC; the second pass
  // corrects the rare case where a DST transition sits between the two.
  let offset = tzOffsetAt(wallUtc, timeZone);
  offset = tzOffsetAt(wallUtc - offset, timeZone);
  return wallUtc - offset;
}

/**
 * Build an array of available booking slots for a single day.
 *
 * Algorithm:
 *  1. Walk from `workingStart` to `workingEnd` in `slotIntervalMin` steps
 *     (wall-clock minutes in the business timezone).
 *  2. For each candidate slot [start, start + serviceDuration]:
 *     a. Discard if the slot has already started (compared to `nowMs`).
 *     b. Discard if it overlaps with any entry in `bookedWindows`.
 *  3. Return surviving slots.
 *
 * Overlap condition: two intervals [a,b) and [c,d) overlap iff a < d && b > c.
 *
 * @param dateStr          "YYYY-MM-DD" — the calendar date in the business timezone.
 * @param workingStart     "HH:MM" 24-hour, wall time in the business timezone.
 * @param workingEnd       "HH:MM" 24-hour, wall time in the business timezone.
 * @param serviceDurationMin  Duration of the service in minutes.
 * @param slotIntervalMin  Granularity between candidate slot starts (e.g. 30).
 * @param bookedWindows    Non-cancelled existing appointments for the barber that day.
 * @param nowMs            Current time in ms (injectable for testability).
 * @param timezone         IANA timezone of the business (e.g. "Asia/Jerusalem").
 */
export function generateAvailableSlots(
  dateStr: string,
  workingStart: string,
  workingEnd: string,
  serviceDurationMin: number,
  slotIntervalMin: number,
  bookedWindows: BookedWindow[],
  nowMs: number = Date.now(),
  timezone: string = "UTC"
): TimeSlot[] {
  const startMin   = timeStringToMinutes(workingStart);
  const endMin     = timeStringToMinutes(workingEnd);
  const durationMs = serviceDurationMin * 60_000;

  const slots: TimeSlot[] = [];

  for (let m = startMin; m + serviceDurationMin <= endMin; m += slotIntervalMin) {
    // Real instant of this wall-clock time in the business timezone.
    const slotStart = zonedTimeToUtcMs(dateStr, m, timezone);

    // Skip slots that have already passed.
    if (slotStart <= nowMs) continue;

    const slotEnd = slotStart + durationMs;

    const isBooked = bookedWindows.some(
      (w) => w.startTime < slotEnd && w.endTime > slotStart
    );

    if (!isBooked) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
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

// ─── Subscription access ─────────────────────────────────────────────────────

/**
 * Single source of truth for whether a business currently has access to the
 * product (admin dashboard + accepting bookings). Computed live so no cron is
 * needed to expire trials.
 *
 * Access is granted when:
 *  - the subscription is `active` (paid), OR
 *  - the business is still inside its trial window.
 *
 * Access is denied when the trial has expired, or the subscription is
 * `past_due` / `cancelled`. A missing `trialEndsAt` is treated as "still in
 * trial" (fail-open) so template / manually-created businesses aren't locked
 * out — the provision flow always sets a real trial end.
 */
export function isSubscriptionActive(
  business: { subscriptionStatus?: string; trialEndsAt?: number | null },
  now: number = Date.now()
): boolean {
  const status = business.subscriptionStatus ?? "trial";
  if (status === "active") return true;
  if (status === "trial") {
    return business.trialEndsAt == null || business.trialEndsAt > now;
  }
  return false; // past_due, cancelled
}
