import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** All special-schedule overrides for a business (includes all barbers). */
export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    return await ctx.db
      .query("specialSchedules")
      .withIndex("by_business_date", (q) => q.eq("businessId", businessId))
      .collect();
  },
});

/**
 * Create or update the override for a (business/barber, date) pair.
 * A second call for the same date + barberId replaces the previous entry.
 */
export const upsert = mutation({
  args: {
    businessId: v.id("businesses"),
    barberId: v.optional(v.id("barbers")),
    date: v.string(),
    isClosed: v.boolean(),
    customStart: v.optional(v.string()),
    customEnd: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query("specialSchedules")
      .withIndex("by_business_date", (q) =>
        q.eq("businessId", args.businessId).eq("date", args.date)
      )
      .collect();

    const existing = candidates.find((c) =>
      args.barberId ? c.barberId === args.barberId : !c.barberId
    );

    const patch = {
      isClosed: args.isClosed,
      customStart: args.customStart,
      customEnd: args.customEnd,
      note: args.note,
      barberId: args.barberId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("specialSchedules", {
      businessId: args.businessId,
      date: args.date,
      ...patch,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("specialSchedules") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
