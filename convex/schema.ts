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
    isActive: v.optional(v.boolean()),
    // Multi-tenant fields
    slug: v.optional(v.string()),
    temporaryPassword: v.optional(v.string()),
    salonLink: v.optional(v.string()),
    adminPassword: v.optional(v.string()),
    isFirstLogin: v.optional(v.boolean()),
    isTemplate: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_template", ["isTemplate"]),

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
    price: v.number(),            // base / min price in agorot (always set)
    maxPrice: v.optional(v.number()),  // max price in agorot (enables range display)
    pricesByLength: v.optional(v.object({
      short:  v.optional(v.number()),  // קצר
      medium: v.optional(v.number()),  // בינוני
      long:   v.optional(v.number()),  // ארוך
    })),
    requiresHairDetails: v.optional(v.boolean()),
    depositAmount: v.optional(v.number()), // in agorot; absent/0 = no deposit required
    bufferMinutes: v.optional(v.number()),  // gap after service before next booking
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
    finalPrice: v.optional(v.number()), // actual price charged (may differ from service.price when pricesByLength is used)
    notes: v.optional(v.string()),
    hairDetails: v.optional(v.object({
      hairLength: v.optional(v.string()),
      hairCondition: v.optional(v.string()),
      bleachHistory: v.optional(v.string()),
      grayHairPercentage: v.optional(v.string()),
      previousKeratin: v.optional(v.string()),
      currentHairPhotoStorageId: v.optional(v.string()),
      desiredHairPhotoStorageId: v.optional(v.string()),
      currentHairColorCode: v.optional(v.string()),
      desiredHairColorCode: v.optional(v.string()),
    })),
  })
    .index("by_barber", ["barberId"])
    .index("by_barber_time", ["barberId", "startTime"])
    .index("by_customer", ["customerPhone"])
    .index("by_customer_business", ["customerPhone", "businessId"])
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

  // ─── gallery ─────────────────────────────────────────────────────────────
  gallery: defineTable({
    businessId: v.id("businesses"),
    serviceId: v.optional(v.id("services")),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
  })
    .index("by_business", ["businessId"])
    .index("by_business_service", ["businessId", "serviceId"]),

  // ─── settings ────────────────────────────────────────────────────────────
  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  // ─── waitingList ─────────────────────────────────────────────────────────
  waitingList: defineTable({
    businessId: v.id("businesses"),
    barberId: v.optional(v.id("barbers")),
    serviceId: v.optional(v.id("services")),
    date: v.string(), // "YYYY-MM-DD"
    timePreference: v.union(
      v.literal("morning"),   // בוקר 06:00–13:00
      v.literal("evening"),   // ערב  13:00–21:00
      v.literal("any")        // כל היום
    ),
    customerName: v.string(),
    customerPhone: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("notified"),
      v.literal("booked"),
      v.literal("expired")
    ),
    notes: v.optional(v.string()),
  })
    .index("by_business_date", ["businessId", "date"])
    .index("by_business_date_status", ["businessId", "date", "status"])
    .index("by_customer_phone", ["customerPhone"]),
});
