import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const localizedString = v.object({
  he: v.string(),
  ar: v.string(),
});

export const dayScheduleValidator = v.object({
  day: v.number(),   // 0 = Sunday … 6 = Saturday
  start: v.string(), // "HH:MM" in the business timezone
  end: v.string(),   // "HH:MM"
});

/**
 * Working hours. Preferred format: `daySchedules` — per-day start/end times.
 * Legacy flat fields (`days`, `start`, `end`) kept for backward compatibility.
 */
const workingHoursValidator = v.object({
  daySchedules: v.optional(v.array(dayScheduleValidator)),
  // Legacy flat format
  days: v.optional(v.array(v.number())),
  start: v.optional(v.string()),
  end: v.optional(v.string()),
  slotIntervalMinutes: v.optional(v.number()),
});

export default defineSchema({
  // ─── businesses ──────────────────────────────────────────────────────────
  businesses: defineTable({
    name: localizedString,
    description: localizedString,
    address: v.string(),
    phone: v.string(),
    logoUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    workingHours: workingHoursValidator,
    timezone: v.optional(v.string()),
  }),

  // ─── barbers ─────────────────────────────────────────────────────────────
  barbers: defineTable({
    businessId: v.id("businesses"),
    name: localizedString,
    role: localizedString,
    avatarUrl: v.optional(v.string()),
    specializedServices: v.array(v.string()),
    workingHours: v.optional(workingHoursValidator),
    isActive: v.boolean(),
  })
    .index("by_business", ["businessId"])
    .index("by_business_active", ["businessId", "isActive"]),

  // ─── services ────────────────────────────────────────────────────────────
  services: defineTable({
    businessId: v.id("businesses"),
    name: localizedString,
    description: localizedString,
    duration: v.number(),
    price: v.number(),
    isActive: v.boolean(),
  })
    .index("by_business", ["businessId"])
    .index("by_business_active", ["businessId", "isActive"]),

  // ─── appointments ─────────────────────────────────────────────────────────
  appointments: defineTable({
    businessId: v.id("businesses"),
    barberId: v.id("barbers"),
    serviceId: v.id("services"),
    customerName: v.string(),
    customerPhone: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("cancelled")
    ),
    notes: v.optional(v.string()),
  })
    .index("by_barber", ["barberId"])
    .index("by_barber_time", ["barberId", "startTime"])
    .index("by_customer", ["customerPhone"])
    .index("by_business", ["businessId"])
    .index("by_business_time", ["businessId", "startTime"]),

  // ─── specialSchedules ────────────────────────────────────────────────────
  specialSchedules: defineTable({
    businessId: v.id("businesses"),
    barberId: v.optional(v.id("barbers")), // absent = applies to whole business
    date: v.string(), // "YYYY-MM-DD"
    isClosed: v.boolean(),
    customStart: v.optional(v.string()), // "HH:MM" — used when !isClosed
    customEnd: v.optional(v.string()),
    note: v.optional(v.string()),
  }).index("by_business_date", ["businessId", "date"]),
});
