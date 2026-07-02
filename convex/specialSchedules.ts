import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireBusinessSession } from "./authHelpers";

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
 * Create or update the override for a (business, date) pair.
 * A second call for the same date replaces the previous entry.
 */
export const upsert = mutation({
  args: {
    token: v.string(),
    businessId: v.id("businesses"),
    date: v.string(),
    isClosed: v.boolean(),
    customStart: v.optional(v.string()),
    customEnd: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...args }) => {
    await requireBusinessSession(ctx, token, args.businessId);

    const candidates = await ctx.db
      .query("specialSchedules")
      .withIndex("by_business_date", (q) =>
        q.eq("businessId", args.businessId).eq("date", args.date)
      )
      .collect();

    const existing = candidates[0];

    const patch = {
      isClosed: args.isClosed,
      customStart: args.customStart,
      customEnd: args.customEnd,
      note: args.note,
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
  args: { token: v.string(), id: v.id("specialSchedules") },
  handler: async (ctx, { token, id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Not found");
    await requireBusinessSession(ctx, token, existing.businessId);
    await ctx.db.delete(id);
  },
});
