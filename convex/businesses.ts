import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
      workingHours: {
        daySchedules: [
          { day: 0, start: "09:00", end: "19:00" },
          { day: 1, start: "09:00", end: "19:00" },
          { day: 2, start: "09:00", end: "19:00" },
          { day: 3, start: "09:00", end: "19:00" },
          { day: 4, start: "09:00", end: "19:00" },
        ],
        slotIntervalMinutes: 30,
      },
      timezone: "Asia/Jerusalem",
      isActive: true,
      temporaryPassword: tempPassword,
      salonLink,
      adminPassword: tempPassword,
      isFirstLogin: true,
    });

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

    // Strip undefined values so we only patch provided fields.
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
