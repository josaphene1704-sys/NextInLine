import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ──────────────────────────────────────────────────────────────────

/** All active services for a given business. */
export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    return await ctx.db
      .query("services")
      .withIndex("by_business_active", (q) =>
        q.eq("businessId", businessId).eq("isActive", true)
      )
      .collect();
  },
});

/** Admin: all services for a business, including inactive ones. */
export const getAllByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    return await ctx.db
      .query("services")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
  },
});

export const getById = query({
  args: { serviceId: v.id("services") },
  handler: async (ctx, { serviceId }) => {
    return await ctx.db.get(serviceId);
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    name: v.object({ he: v.string(), ar: v.string() }),
    description: v.object({ he: v.string(), ar: v.string() }),
    duration: v.number(),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business) throw new Error("Business not found");
    if (args.duration <= 0) throw new Error("Duration must be positive");
    if (args.price < 0) throw new Error("Price cannot be negative");

    return await ctx.db.insert("services", { ...args, isActive: true });
  },
});

export const update = mutation({
  args: {
    serviceId: v.id("services"),
    name: v.optional(v.object({ he: v.string(), ar: v.string() })),
    description: v.optional(v.object({ he: v.string(), ar: v.string() })),
    duration: v.optional(v.number()),
    price: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { serviceId, ...fields }) => {
    const existing = await ctx.db.get(serviceId);
    if (!existing) throw new Error("Service not found");
    if (fields.duration !== undefined && fields.duration <= 0)
      throw new Error("Duration must be positive");
    if (fields.price !== undefined && fields.price < 0)
      throw new Error("Price cannot be negative");

    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(serviceId, patch);
    return { success: true };
  },
});
