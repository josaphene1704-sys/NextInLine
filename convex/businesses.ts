import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getById = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    return await ctx.db.get(businessId);
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("businesses").collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Clones all services from `templateId` into `targetId`.
 * Returns a map of old serviceId → new serviceId so barbers can be remapped.
 */
async function cloneServices(
  ctx: any,
  templateId: Id<"businesses">,
  targetId: Id<"businesses">
): Promise<Record<string, Id<"services">>> {
  const templateServices = await ctx.db
    .query("services")
    .withIndex("by_business", (q: any) => q.eq("businessId", templateId))
    .take(100);

  const idMap: Record<string, Id<"services">> = {};
  for (const svc of templateServices) {
    const { _id, _creationTime, businessId: _bid, ...rest } = svc;
    const newId = await ctx.db.insert("services", { ...rest, businessId: targetId });
    idMap[_id] = newId;
  }
  return idMap;
}

/**
 * Clones all barbers from `templateId` into `targetId`,
 * remapping specializedServices using `serviceIdMap`.
 */
async function cloneBarbers(
  ctx: any,
  templateId: Id<"businesses">,
  targetId: Id<"businesses">,
  serviceIdMap: Record<string, Id<"services">>
): Promise<void> {
  const templateBarbers = await ctx.db
    .query("barbers")
    .withIndex("by_business", (q: any) => q.eq("businessId", templateId))
    .take(50);

  for (const barber of templateBarbers) {
    const { _id, _creationTime, businessId: _bid, specializedServices, ...rest } = barber;
    const newSpecialized = specializedServices
      .map((sid: string) => serviceIdMap[sid])
      .filter((id: Id<"services"> | undefined): id is Id<"services"> => id !== undefined);
    await ctx.db.insert("barbers", {
      ...rest,
      businessId: targetId,
      specializedServices: newSpecialized,
    });
  }
}

/** Hardcoded fallback when no template business exists yet. */
async function seedHardcodedDefaults(
  ctx: any,
  businessId: Id<"businesses">,
  nameHe: string
): Promise<void> {
  const s1 = await ctx.db.insert("services", {
    businessId,
    name: { he: "תספורת", ar: "قصة شعر" },
    description: { he: "תספורת מקצועית", ar: "قصة شعر احترافية" },
    duration: 30,
    price: 5000,
    isActive: true,
  });
  const s2 = await ctx.db.insert("services", {
    businessId,
    name: { he: "תספורת + זקן", ar: "قصة شعر ولحية" },
    description: { he: "תספורת ועיצוב זקן", ar: "قصة شعر وتشكيل لحية" },
    duration: 45,
    price: 7000,
    isActive: true,
  });
  const s3 = await ctx.db.insert("services", {
    businessId,
    name: { he: "צביעה", ar: "صباغة" },
    description: { he: "צביעת שיער מקצועית", ar: "صباغة شعر احترافية" },
    duration: 90,
    price: 15000,
    isActive: true,
  });
  const s4 = await ctx.db.insert("services", {
    businessId,
    name: { he: "טיפול שיער", ar: "علاج الشعر" },
    description: { he: "טיפול שיער מזין ומשקם", ar: "علاج مغذٍ ومرمم للشعر" },
    duration: 60,
    price: 12000,
    isActive: true,
  });
  await ctx.db.insert("barbers", {
    businessId,
    name: { he: nameHe, ar: nameHe },
    role: { he: "בעל העסק", ar: "صاحب العمل" },
    specializedServices: [s1, s2, s3, s4],
    isActive: true,
  });
}

// ─── provision ────────────────────────────────────────────────────────────────

export const provision = mutation({
  args: {
    slug: v.string(),
    nameHe: v.string(),
  },
  handler: async (ctx, { slug, nameHe }) => {
    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) throw new Error(`הסלאג "${slug}" כבר קיים במערכת`);

    // Find the template business (first existing) BEFORE inserting the new one.
    const template = await ctx.db.query("businesses").first();

    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let tempPassword = "";
    for (let i = 0; i < 8; i++) {
      tempPassword += chars[Math.floor(Math.random() * chars.length)];
    }

    const baseUrl = process.env.SITE_URL ?? "https://next-in-line-teal.vercel.app";
    const salonLink = `${baseUrl}/salon/${slug}`;

    const businessId = await ctx.db.insert("businesses", {
      slug,
      name: { he: nameHe, ar: nameHe },
      description: { he: "", ar: "" },
      address: "",
      phone: "",
      // Inherit working hours & timezone from the template so slot settings are identical
      workingHours: template?.workingHours ?? {
        daySchedules: [
          { day: 0, start: "09:00", end: "19:00" },
          { day: 1, start: "09:00", end: "19:00" },
          { day: 2, start: "09:00", end: "19:00" },
          { day: 3, start: "09:00", end: "19:00" },
          { day: 4, start: "09:00", end: "19:00" },
        ],
        slotIntervalMinutes: 30,
      },
      timezone: template?.timezone ?? "Asia/Jerusalem",
      isActive: true,
      temporaryPassword: tempPassword,
      salonLink,
      adminPassword: tempPassword,
      isFirstLogin: true,
    });

    if (template) {
      // Clone all services & barbers from the template business
      const serviceIdMap = await cloneServices(ctx, template._id, businessId);
      await cloneBarbers(ctx, template._id, businessId, serviceIdMap);
    } else {
      // No template yet — seed hardcoded defaults
      await seedHardcodedDefaults(ctx, businessId, nameHe);
    }

    return { businessId, temporaryPassword: tempPassword, salonLink };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

const workingHoursArg = v.object({
  daySchedules: v.optional(v.array(v.object({ day: v.number(), start: v.string(), end: v.string() }))),
  days: v.optional(v.array(v.number())),
  start: v.optional(v.string()),
  end: v.optional(v.string()),
  slotIntervalMinutes: v.optional(v.number()),
});

export const create = mutation({
  args: {
    name: v.object({ he: v.string(), ar: v.string() }),
    description: v.object({ he: v.string(), ar: v.string() }),
    address: v.string(),
    phone: v.string(),
    logoUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    workingHours: workingHoursArg,
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("businesses", args);
  },
});

export const update = mutation({
  args: {
    businessId: v.id("businesses"),
    name: v.optional(v.object({ he: v.string(), ar: v.string() })),
    description: v.optional(v.object({ he: v.string(), ar: v.string() })),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    workingHours: v.optional(workingHoursArg),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, { businessId, ...fields }) => {
    const existing = await ctx.db.get(businessId);
    if (!existing) throw new Error("Business not found");

    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(businessId, patch);
    return { success: true };
  },
});

export const setIsActive = mutation({
  args: { businessId: v.id("businesses"), isActive: v.boolean() },
  handler: async (ctx, { businessId, isActive }) => {
    const existing = await ctx.db.get(businessId);
    if (!existing) throw new Error("Business not found");
    await ctx.db.patch(businessId, { isActive });
    return { success: true };
  },
});

/**
 * Fills an empty business with services & barbers cloned from the first
 * existing business (the "template"). Falls back to hardcoded defaults
 * when no other business exists.
 * Safe to call repeatedly — no-op if this business already has services.
 */
export const seedDefaultsIfEmpty = mutation({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    const business = await ctx.db.get(businessId);
    if (!business) throw new Error("Business not found");

    const existingService = await ctx.db
      .query("services")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .take(1);

    if (existingService.length > 0) return { skipped: true };

    // Find a template — any other business that has services
    const allBusinesses = await ctx.db.query("businesses").take(20);
    const template = allBusinesses.find((b) => b._id !== businessId) ?? null;

    if (template) {
      const templateHasServices = await ctx.db
        .query("services")
        .withIndex("by_business", (q) => q.eq("businessId", template._id))
        .take(1);

      if (templateHasServices.length > 0) {
        const serviceIdMap = await cloneServices(ctx, template._id, businessId);

        const existingBarbers = await ctx.db
          .query("barbers")
          .withIndex("by_business", (q) => q.eq("businessId", businessId))
          .take(1);

        if (existingBarbers.length === 0) {
          await cloneBarbers(ctx, template._id, businessId, serviceIdMap);
        }

        // Also inherit working hours if still at default
        await ctx.db.patch(businessId, {
          workingHours: template.workingHours,
          timezone: template.timezone ?? "Asia/Jerusalem",
        });

        return { seeded: true, source: "template" };
      }
    }

    // No usable template — fall back to hardcoded defaults
    await seedHardcodedDefaults(ctx, businessId, business.name.he);
    return { seeded: true, source: "defaults" };
  },
});
