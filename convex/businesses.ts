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
