import { internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  generateAvailableSlots,
  normalizeDaySchedules,
  dayBoundsFromDateStr,
  isValidPhone,
} from "./helpers";

// ─── getAvailableSlots ────────────────────────────────────────────────────────

/**
 * Returns all bookable time slots for a (barber, service, date) triple.
 *
 * Steps:
 *  1. Resolve barber → business → working hours (barber-level overrides business-level).
 *  2. Resolve service duration.
 *  3. Validate the requested date is a working day.
 *  4. Validate the service belongs to the same business as the barber.
 *  5. Query existing non-cancelled appointments for that barber on that day.
 *  6. Delegate slot generation to the pure helper (testable independently).
 *
 * @param date  "YYYY-MM-DD" string, treated as UTC midnight.
 */
export const getAvailableSlots = query({
  args: {
    barberId: v.id("barbers"),
    serviceId: v.id("services"),
    date: v.string(),
  },
  handler: async (ctx, { barberId, serviceId, date }) => {
    // 1. Resolve barber and business.
    const barber = await ctx.db.get(barberId);
    if (!barber || !barber.isActive) {
      throw new Error("Barber not found or inactive");
    }

    const business = await ctx.db.get(barber.businessId);
    if (!business) throw new Error("Business not found");

    // 2. Resolve service.
    const service = await ctx.db.get(serviceId);
    if (!service || !service.isActive) {
      throw new Error("Service not found or inactive");
    }

    // 3. Validate service belongs to the same business.
    if (service.businessId !== barber.businessId) {
      throw new Error("Service does not belong to this business");
    }

    // 4. Resolve per-day schedule.
    const [year, month, day] = date.split("-").map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = utcDate.getUTCDay();

    const schedule = barber.workingHours ?? business.workingHours;
    const daySchedules = normalizeDaySchedules(schedule);
    const daySchedule = daySchedules.find((d) => d.day === dayOfWeek);

    // 5. Check for special-schedule overrides for this exact date.
    const specialEntries = await ctx.db
      .query("specialSchedules")
      .withIndex("by_business_date", (q) =>
        q.eq("businessId", barber.businessId).eq("date", date)
      )
      .take(20);

    // Barber-specific entry takes precedence over business-wide entry.
    const special =
      specialEntries.find((s) => s.barberId === barberId) ??
      specialEntries.find((s) => !s.barberId);

    let workingStart: string;
    let workingEnd: string;

    if (special) {
      if (special.isClosed) return { slots: [], isWorkingDay: false };
      workingStart = special.customStart ?? daySchedule?.start ?? "09:00";
      workingEnd   = special.customEnd   ?? daySchedule?.end   ?? "19:00";
    } else if (!daySchedule) {
      return { slots: [], isWorkingDay: false };
    } else {
      workingStart = daySchedule.start;
      workingEnd   = daySchedule.end;
    }

    // 6. Fetch existing non-cancelled appointments for this barber on this day.
    const { dayStartMs, dayEndMs } = dayBoundsFromDateStr(date);

    const existingAppointments = await ctx.db
      .query("appointments")
      .withIndex("by_barber_time", (q) =>
        q
          .eq("barberId", barberId)
          .gte("startTime", dayStartMs)
          .lt("startTime", dayEndMs)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();

    // 7. Generate available slots.
    const slotInterval = schedule.slotIntervalMinutes ?? 30;

    const slots = generateAvailableSlots(
      date,
      workingStart,
      workingEnd,
      service.duration,
      slotInterval,
      existingAppointments.map(({ startTime, endTime }) => ({
        startTime,
        endTime,
      }))
    );

    return {
      slots,
      isWorkingDay: true,
      timezone: business.timezone ?? "UTC",
    };
  },
});

// ─── createAppointment ────────────────────────────────────────────────────────

/**
 * Books an appointment after a final server-side conflict check.
 *
 * The client already ran getAvailableSlots, but we re-validate here to guard
 * against the race condition where two users pick the same slot simultaneously.
 * Convex mutations are serialised per document, so this check is safe.
 */
export const createAppointment = mutation({
  args: {
    barberId: v.id("barbers"),
    serviceId: v.id("services"),
    customerName: v.string(),
    customerPhone: v.string(),
    startTime: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { barberId, serviceId, customerName, customerPhone, startTime, notes } =
      args;

    // ── Input validation ──────────────────────────────────────────────────
    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();

    if (!trimmedName) throw new Error("Customer name is required");
    if (!isValidPhone(trimmedPhone)) throw new Error("Invalid phone number format");
    if (startTime <= Date.now()) {
      throw new Error("Cannot book an appointment in the past");
    }

    // ── Resolve entities ──────────────────────────────────────────────────
    const barber = await ctx.db.get(barberId);
    if (!barber || !barber.isActive) throw new Error("Barber not found or inactive");

    const service = await ctx.db.get(serviceId);
    if (!service || !service.isActive) throw new Error("Service not found or inactive");

    if (service.businessId !== barber.businessId) {
      throw new Error("Service and barber belong to different businesses");
    }

    const endTime = startTime + service.duration * 60_000;

    // ── Race-condition guard: re-check slot availability ──────────────────
    //
    // We query only the day window of the requested startTime to keep the
    // index scan tight; the in-memory overlap check then covers the exact range.
    const dayStart = new Date(startTime);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayStartMs + 86_400_000;

    const sameDay = await ctx.db
      .query("appointments")
      .withIndex("by_barber_time", (q) =>
        q
          .eq("barberId", barberId)
          .gte("startTime", dayStartMs)
          .lt("startTime", dayEndMs)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();

    const hasConflict = sameDay.some(
      (a) => a.startTime < endTime && a.endTime > startTime
    );

    if (hasConflict) {
      throw new Error(
        "This time slot is no longer available. Please choose another slot."
      );
    }

    // ── Persist ───────────────────────────────────────────────────────────
    const appointmentId = await ctx.db.insert("appointments", {
      businessId: barber.businessId,
      barberId,
      serviceId,
      customerName: trimmedName,
      customerPhone: trimmedPhone,
      startTime,
      endTime,
      status: "pending",
      notes,
    });

    // Schedule the WhatsApp confirmation — fires immediately after this
    // mutation commits, so the appointment is guaranteed to exist.
    await ctx.scheduler.runAfter(0, internal.whatsapp.sendConfirmation, {
      appointmentId,
    });

    return appointmentId;
  },
});

// ─── getCustomerAppointments ──────────────────────────────────────────────────

/**
 * Returns a customer's full appointment history (newest first),
 * enriched with denormalised barber, service, and business data
 * so the client needs a single query call.
 */
export const getCustomerAppointments = query({
  args: { customerPhone: v.string() },
  handler: async (ctx, { customerPhone }) => {
    if (!customerPhone.trim()) return [];

    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_customer", (q) =>
        q.eq("customerPhone", customerPhone.trim())
      )
      .order("desc")
      .collect();

    return await Promise.all(
      appointments.map(async (appt) => {
        const [barber, service, business] = await Promise.all([
          ctx.db.get(appt.barberId),
          ctx.db.get(appt.serviceId),
          ctx.db.get(appt.businessId),
        ]);
        return { ...appt, barber, service, business };
      })
    );
  },
});

// ─── updateAppointmentStatus ──────────────────────────────────────────────────

export const updateAppointmentStatus = mutation({
  args: {
    appointmentId: v.id("appointments"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, { appointmentId, status }) => {
    const appointment = await ctx.db.get(appointmentId);
    if (!appointment) throw new Error("Appointment not found");

    if (
      status === "cancelled" &&
      appointment.status === "confirmed" &&
      appointment.startTime < Date.now()
    ) {
      throw new Error("Cannot cancel a past confirmed appointment");
    }

    await ctx.db.patch(appointmentId, { status });
    return { success: true };
  },
});

// ─── getRange ────────────────────────────────────────────────────────────────

/** Admin: enriched appointments in a time range (past + future). */
export const getRange = query({
  args: {
    businessId: v.id("businesses"),
    fromMs: v.number(),
    toMs: v.number(),
    barberId: v.optional(v.id("barbers")),
  },
  handler: async (ctx, { businessId, fromMs, toMs, barberId }) => {
    const rows = await ctx.db
      .query("appointments")
      .withIndex("by_business_time", (q) =>
        q.eq("businessId", businessId).gte("startTime", fromMs).lt("startTime", toMs)
      )
      .order("asc")
      .take(500);

    const filtered = barberId ? rows.filter((a) => a.barberId === barberId) : rows;

    return await Promise.all(
      filtered.map(async (appt) => {
        const [barber, service] = await Promise.all([
          ctx.db.get(appt.barberId),
          ctx.db.get(appt.serviceId),
        ]);
        return { ...appt, barber, service };
      })
    );
  },
});

// ─── getUpcoming ─────────────────────────────────────────────────────────────

/**
 * Upcoming appointments for admin calendar view, enriched with barber/service.
 * Ordered by startTime asc. Optionally filtered to a specific barber.
 */
export const getUpcoming = query({
  args: {
    businessId: v.id("businesses"),
    fromMs: v.number(),
    barberId: v.optional(v.id("barbers")),
  },
  handler: async (ctx, { businessId, fromMs, barberId }) => {
    const rows = await ctx.db
      .query("appointments")
      .withIndex("by_business_time", (q) =>
        q.eq("businessId", businessId).gte("startTime", fromMs)
      )
      .order("asc")
      .take(300);

    const filtered = barberId ? rows.filter((a) => a.barberId === barberId) : rows;

    return await Promise.all(
      filtered.map(async (appt) => {
        const [barber, service] = await Promise.all([
          ctx.db.get(appt.barberId),
          ctx.db.get(appt.serviceId),
        ]);
        return { ...appt, barber, service };
      })
    );
  },
});

// ─── getAppointmentDetails (internal) ────────────────────────────────────────
// Used by the WhatsApp confirmation action to read a freshly-booked appointment.

export const getAppointmentDetails = internalQuery({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    const appt = await ctx.db.get(appointmentId);
    if (!appt) return null;
    const [barber, service, business] = await Promise.all([
      ctx.db.get(appt.barberId),
      ctx.db.get(appt.serviceId),
      ctx.db.get(appt.businessId),
    ]);
    return { appt, barber, service, business };
  },
});

// ─── getById ──────────────────────────────────────────────────────────────────

export const getById = query({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, { appointmentId }) => {
    return await ctx.db.get(appointmentId);
  },
});

// ─── getByBusiness ────────────────────────────────────────────────────────────

/**
 * Fetches appointments for a business, optionally filtered to a single day.
 * Used by the admin/dashboard view.
 *
 * @param date  Optional "YYYY-MM-DD" filter.
 */
export const getByBusiness = query({
  args: {
    businessId: v.id("businesses"),
    date: v.optional(v.string()),
  },
  handler: async (ctx, { businessId, date }) => {
    if (date) {
      const { dayStartMs, dayEndMs } = dayBoundsFromDateStr(date);

      return await ctx.db
        .query("appointments")
        .withIndex("by_business_time", (q) =>
          q
            .eq("businessId", businessId)
            .gte("startTime", dayStartMs)
            .lt("startTime", dayEndMs)
        )
        .order("asc")
        .collect();
    }

    return await ctx.db
      .query("appointments")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .order("desc")
      .collect();
  },
});
