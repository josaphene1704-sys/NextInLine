import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireBusinessSession } from "./authHelpers";
import { getSoleBarberReadonly } from "./barberHelpers";

// ─── Queries ──────────────────────────────────────────────────────────────────

/** The single barber for a business — used by the booking flow instead of a picker. */
export const getSoleBarber = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => getSoleBarberReadonly(ctx, businessId),
});

/** All active barbers/stylists for a given business. */
export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    return await ctx.db
      .query("barbers")
      .withIndex("by_business_active", (q) =>
        q.eq("businessId", businessId).eq("isActive", true)
      )
      .collect();
  },
});

/** Admin: all barbers for a business, including inactive ones. */
export const getAllByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    return await ctx.db
      .query("barbers")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
  },
});

export const getById = query({
  args: { barberId: v.id("barbers") },
  handler: async (ctx, { barberId }) => {
    return await ctx.db.get(barberId);
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

const workingHoursArg = v.optional(
  v.object({
    daySchedules: v.optional(v.array(v.object({ day: v.number(), start: v.string(), end: v.string() }))),
    days: v.optional(v.array(v.number())),
    start: v.optional(v.string()),
    end: v.optional(v.string()),
    slotIntervalMinutes: v.optional(v.number()),
  })
);

export const create = mutation({
  args: {
    token: v.string(),
    businessId: v.id("businesses"),
    name: v.object({ he: v.string(), ar: v.string() }),
    role: v.object({ he: v.string(), ar: v.string() }),
    avatarUrl: v.optional(v.string()),
    specializedServices: v.array(v.string()),
    workingHours: workingHoursArg,
  },
  handler: async (ctx, { token, ...args }) => {
    await requireBusinessSession(ctx, token, args.businessId);

    const business = await ctx.db.get(args.businessId);
    if (!business) throw new Error("Business not found");

    return await ctx.db.insert("barbers", { ...args, isActive: true });
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    barberId: v.id("barbers"),
    name: v.optional(v.object({ he: v.string(), ar: v.string() })),
    role: v.optional(v.object({ he: v.string(), ar: v.string() })),
    avatarUrl: v.optional(v.string()),
    specializedServices: v.optional(v.array(v.string())),
    workingHours: workingHoursArg,
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, barberId, ...fields }) => {
    const existing = await ctx.db.get(barberId);
    if (!existing) throw new Error("Barber not found");
    await requireBusinessSession(ctx, token, existing.businessId);

    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(barberId, patch);
    return { success: true };
  },
});
