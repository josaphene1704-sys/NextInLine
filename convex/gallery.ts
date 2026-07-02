import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireBusinessSession } from "./authHelpers";

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
    token: v.string(),
    businessId: v.id("businesses"),
    serviceId: v.optional(v.id("services")),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...args }) => {
    await requireBusinessSession(ctx, token, args.businessId);
    return await ctx.db.insert("gallery", args);
  },
});

export const remove = mutation({
  args: { token: v.string(), galleryId: v.id("gallery") },
  handler: async (ctx, { token, galleryId }) => {
    const item = await ctx.db.get(galleryId);
    if (!item) throw new Error("Gallery item not found");
    await requireBusinessSession(ctx, token, item.businessId);
    await ctx.storage.delete(item.storageId);
    await ctx.db.delete(galleryId);
  },
});
