import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByBusiness = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    const items = await ctx.db
      .query("gallery")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(200);

    return await Promise.all(
      items.map(async (item) => ({
        ...item,
        url: await ctx.storage.getUrl(item.storageId),
      }))
    );
  },
});

export const add = mutation({
  args: {
    businessId: v.id("businesses"),
    serviceId: v.optional(v.id("services")),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("gallery", args);
  },
});

export const remove = mutation({
  args: { galleryId: v.id("gallery") },
  handler: async (ctx, { galleryId }) => {
    const item = await ctx.db.get(galleryId);
    if (!item) throw new Error("Gallery item not found");
    await ctx.storage.delete(item.storageId);
    await ctx.db.delete(galleryId);
  },
});
