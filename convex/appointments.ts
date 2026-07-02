import { internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  generateAvailableSlots,
  normalizeDaySchedules,
  dayBoundsFromDateStr,
  isValidPhone,
} from "./helpers";
import { requireBusinessSession } from "./authHelpers";
import { getSoleBarber, getSoleBarberReadonly } from "./barberHelpers";

// ─── getAvailableSlots ────────────────────────────────────────────────────────

/**
 * Returns all bookable time slots for a (business, service, date) triple.
 * The business's sole barber is resolved server-side.
 *
 * Steps:
 *  1. Resolve business's sole barber → working hours (barber-level overrides business-level).
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
    businessId: v.id("businesses"),
    serviceId: v.id("services"),
    date: v.string(),
  },
  handler: async (ctx, { businessId, serviceId, date }) => {
    // 1. Resolve business and its sole barber.
    const business = await ctx.db.get(businessId);
    if (!business) throw new Error("Business not found");

    const barber = await getSoleBarberReadonly(ctx, businessId);
    if (!barber.isActive) {
      throw new Error("No active barber configured for this business");
    }
    const barberId = barber._id;

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

    // 7. Extend each existing appointment's end by its service buffer.
    const bookedWindows = await Promise.all(
      existingAppointments.map(async (appt) => {
        const svc = await ctx.db.get(appt.serviceId);
        const bufferMs = (svc?.bufferMinutes ?? 0) * 60_000;
        return { startTime: appt.startTime, endTime: appt.endTime + bufferMs };
      })
    );

    // 8. Generate available slots.
    const slotInterval = schedule.slotIntervalMinutes ?? 30;

    const slots = generateAvailableSlots(
      date,
      workingStart,
      workingEnd,
      service.duration,
      slotInterval,
      bookedWindows
    );

    // Also generate all possible slots (ignoring booked) to derive taken slots.
    const allSlots = generateAvailableSlots(
      date,
      workingStart,
      workingEnd,
      service.duration,
      slotInterval,
      []
    );
    const availableSet = new Set(slots.map((s) => s.startTime));
    const bookedSlots = allSlots.filter((s) => !availableSet.has(s.startTime));

    return {
      slots,
      bookedSlots,
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
const hairDetailsValidator = v.optional(v.object({
  hairLength: v.optional(v.string()),
  hairCondition: v.optional(v.string()),
  bleachHistory: v.optional(v.string()),
  grayHairPercentage: v.optional(v.string()),
  previousKeratin: v.optional(v.string()),
  currentHairPhotoStorageId: v.optional(v.string()),
  desiredHairPhotoStorageId: v.optional(v.string()),
  currentHairColorCode: v.optional(v.string()),
  desiredHairColorCode: v.optional(v.string()),
}));

export const createAppointment = mutation({
  args: {
    businessId: v.id("businesses"),
    serviceId: v.id("services"),
    customerName: v.string(),
    customerPhone: v.string(),
    startTime: v.number(),
    finalPrice: v.optional(v.number()),
    notes: v.optional(v.string()),
    hairDetails: hairDetailsValidator,
  },
  handler: async (ctx, args) => {
    const { businessId, serviceId, customerName, customerPhone, startTime, finalPrice, notes, hairDetails } =
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
    const barber = await getSoleBarber(ctx, businessId);
    if (!barber.isActive) throw new Error("No active barber configured for this business");
    const barberId = barber._id;

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

    // Extend each booked window by its service buffer before checking overlap.
    const sameDayExtended = await Promise.all(
      sameDay.map(async (a) => {
        const svc = await ctx.db.get(a.serviceId);
        const bufferMs = (svc?.bufferMinutes ?? 0) * 60_000;
        return { startTime: a.startTime, endTime: a.endTime + bufferMs };
      })
    );

    const hasConflict = sameDayExtended.some(
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
      finalPrice: finalPrice ?? service.price,
      notes,
      hairDetails,
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
  args: {
    customerPhone: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, { customerPhone, businessId }) => {
    if (!customerPhone.trim()) return [];

    const appointments = businessId
      ? await ctx.db
          .query("appointments")
          .withIndex("by_customer_business", (q) =>
            q.eq("customerPhone", customerPhone.trim()).eq("businessId", businessId)
          )
          .order("desc")
          .collect()
      : await ctx.db
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
    // Optional: present for admin callers (AppointmentsCalendar), absent for
    // the anonymous customer self-cancel flow (UpcomingAppointmentsBanner).
    token: v.optional(v.string()),
  },
  handler: async (ctx, { appointmentId, status, token }) => {
    const appointment = await ctx.db.get(appointmentId);
    if (!appointment) throw new Error("Appointment not found");

    // Authorization: "confirmed" is an admin-only transition. "cancelled" is
    // allowed for both an authenticated admin of this business AND an
    // anonymous customer cancelling their own appointment (no login system
    // exists for customers) — but if a token IS supplied on a cancel, it must
    // be valid for this business rather than silently ignored.
    if (status === "confirmed") {
      await requireBusinessSession(ctx, token, appointment.businessId);
    } else if (status === "cancelled" && token) {
      await requireBusinessSession(ctx, token, appointment.businessId);
    }

    if (
      status === "cancelled" &&
      appointment.status === "confirmed" &&
      appointment.startTime < Date.now()
    ) {
      throw new Error("Cannot cancel a past confirmed appointment");
    }

    await ctx.db.patch(appointmentId, { status });

    // When an appointment is cancelled, notify anyone on the waiting list for
    // that date so they can grab the newly freed slot.
    if (status === "cancelled") {
      const d = new Date(appointment.startTime);
      const dateStr =
        `${d.getUTCFullYear()}-` +
        `${String(d.getUTCMonth() + 1).padStart(2, "0")}-` +
        `${String(d.getUTCDate()).padStart(2, "0")}`;

      await ctx.scheduler.runAfter(
        0,
        internal.waitingList.processDateWaitingList,
        { businessId: appointment.businessId, date: dateStr }
      );
    }

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
  },
  handler: async (ctx, { businessId, fromMs, toMs }) => {
    const rows = await ctx.db
      .query("appointments")
      .withIndex("by_business_time", (q) =>
        q.eq("businessId", businessId).gte("startTime", fromMs).lt("startTime", toMs)
      )
      .order("asc")
      .take(500);

    return await Promise.all(
      rows.map(async (appt) => {
        const [barber, service] = await Promise.all([
          ctx.db.get(appt.barberId),
          ctx.db.get(appt.serviceId),
        ]);
        const { hairDetails: rawHairDetails, ...rest } = appt;
        const hairDetails = rawHairDetails
          ? {
              hairLength:         rawHairDetails.hairLength,
              hairCondition:      rawHairDetails.hairCondition,
              bleachHistory:      rawHairDetails.bleachHistory,
              grayHairPercentage: rawHairDetails.grayHairPercentage,
              previousKeratin:    rawHairDetails.previousKeratin,
              currentHairColorCode: rawHairDetails.currentHairColorCode,
              desiredHairColorCode: rawHairDetails.desiredHairColorCode,
              currentHairPhotoUrl: rawHairDetails.currentHairPhotoStorageId
                ? await ctx.storage.getUrl(rawHairDetails.currentHairPhotoStorageId as Id<"_storage">)
                : null,
              desiredHairPhotoUrl: rawHairDetails.desiredHairPhotoStorageId
                ? await ctx.storage.getUrl(rawHairDetails.desiredHairPhotoStorageId as Id<"_storage">)
                : null,
            }
          : undefined;
        const serviceForAdmin = service
          ? { name: service.name, price: service.price, requiresHairDetails: service.requiresHairDetails }
          : null;
        return { ...rest, barber, service: serviceForAdmin, hairDetails, finalPrice: appt.finalPrice ?? service?.price };
      })
    );
  },
});

// ─── getUpcoming ─────────────────────────────────────────────────────────────

/**
 * Upcoming appointments for admin calendar view, enriched with barber/service.
 * Ordered by startTime asc.
 */
export const getUpcoming = query({
  args: {
    businessId: v.id("businesses"),
    fromMs: v.number(),
  },
  handler: async (ctx, { businessId, fromMs }) => {
    const rows = await ctx.db
      .query("appointments")
      .withIndex("by_business_time", (q) =>
        q.eq("businessId", businessId).gte("startTime", fromMs)
      )
      .order("asc")
      .take(300);

    return await Promise.all(
      rows.map(async (appt) => {
        const [barber, service] = await Promise.all([
          ctx.db.get(appt.barberId),
          ctx.db.get(appt.serviceId),
        ]);
        const { hairDetails: rawHairDetails, ...rest } = appt;
        const hairDetails = rawHairDetails
          ? {
              hairLength:         rawHairDetails.hairLength,
              hairCondition:      rawHairDetails.hairCondition,
              bleachHistory:      rawHairDetails.bleachHistory,
              grayHairPercentage: rawHairDetails.grayHairPercentage,
              previousKeratin:    rawHairDetails.previousKeratin,
              currentHairColorCode: rawHairDetails.currentHairColorCode,
              desiredHairColorCode: rawHairDetails.desiredHairColorCode,
              currentHairPhotoUrl: rawHairDetails.currentHairPhotoStorageId
                ? await ctx.storage.getUrl(rawHairDetails.currentHairPhotoStorageId as Id<"_storage">)
                : null,
              desiredHairPhotoUrl: rawHairDetails.desiredHairPhotoStorageId
                ? await ctx.storage.getUrl(rawHairDetails.desiredHairPhotoStorageId as Id<"_storage">)
                : null,
            }
          : undefined;
        const serviceForAdmin = service
          ? { name: service.name, price: service.price, requiresHairDetails: service.requiresHairDetails }
          : null;
        return { ...rest, barber, service: serviceForAdmin, hairDetails, finalPrice: appt.finalPrice ?? service?.price };
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

// ─── getCustomerProfile ───────────────────────────────────────────────────────

/**
 * Full appointment history for a customer, enriched with barber/service/business
 * and resolved photo URLs. Used by the customer profile page and the admin drawer.
 */
export const getCustomerProfile = query({
  args: { customerPhone: v.string() },
  handler: async (ctx, { customerPhone }) => {
    if (!customerPhone.trim()) return [];

    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_customer", (q) => q.eq("customerPhone", customerPhone.trim()))
      .order("desc")
      .take(200);

    return await Promise.all(
      appointments.map(async (appt) => {
        const [barber, service, business] = await Promise.all([
          ctx.db.get(appt.barberId),
          ctx.db.get(appt.serviceId),
          ctx.db.get(appt.businessId),
        ]);
        const { hairDetails: rawHd, ...rest } = appt;
        const hairDetails = rawHd
          ? {
              ...rawHd,
              currentHairPhotoUrl: rawHd.currentHairPhotoStorageId
                ? await ctx.storage.getUrl(rawHd.currentHairPhotoStorageId as Id<"_storage">)
                : null,
              desiredHairPhotoUrl: rawHd.desiredHairPhotoStorageId
                ? await ctx.storage.getUrl(rawHd.desiredHairPhotoStorageId as Id<"_storage">)
                : null,
            }
          : undefined;
        return { ...rest, barber, service, business, hairDetails };
      })
    );
  },
});

// ─── rescheduleAppointment ────────────────────────────────────────────────────
// Customer self-service only today (no admin UI calls this) — intentionally
// left unauthenticated to match the existing anonymous reschedule flow. If an
// admin "reschedule" action is ever added, apply the same optional-token
// pattern used in updateAppointmentStatus above rather than forcing every
// caller through a session.

export const rescheduleAppointment = mutation({
  args: {
    appointmentId: v.id("appointments"),
    startTime: v.number(),
  },
  handler: async (ctx, { appointmentId, startTime }) => {
    const appt = await ctx.db.get(appointmentId);
    if (!appt) throw new Error("Appointment not found");
    if (appt.status === "cancelled") throw new Error("Cannot reschedule a cancelled appointment");
    if (appt.startTime <= Date.now()) throw new Error("Cannot reschedule a past appointment");
    if (startTime <= Date.now()) throw new Error("New time must be in the future");

    const service = await ctx.db.get(appt.serviceId);
    if (!service) throw new Error("Service not found");

    const endTime = startTime + service.duration * 60_000;

    // Race-condition guard: check for conflicts on the new day
    const dayStart = new Date(startTime);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayStartMs + 86_400_000;

    const sameDay = await ctx.db
      .query("appointments")
      .withIndex("by_barber_time", (q) =>
        q.eq("barberId", appt.barberId).gte("startTime", dayStartMs).lt("startTime", dayEndMs)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();

    const others = sameDay.filter((a) => a._id !== appointmentId);

    const othersExtended = await Promise.all(
      others.map(async (a) => {
        const svc = await ctx.db.get(a.serviceId);
        const bufferMs = (svc?.bufferMinutes ?? 0) * 60_000;
        return { startTime: a.startTime, endTime: a.endTime + bufferMs };
      })
    );

    const hasConflict = othersExtended.some(
      (a) => a.startTime < endTime && a.endTime > startTime
    );
    if (hasConflict) throw new Error("This time slot is no longer available. Please choose another.");

    await ctx.db.patch(appointmentId, { startTime, endTime, status: "pending" });
    return { success: true };
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
