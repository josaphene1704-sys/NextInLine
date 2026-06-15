import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { performSeedIfEmpty } from "./businesses";

const DEFAULT_PASSWORD = "admin10";

// ─── verifyAdminPassword ──────────────────────────────────────────────────────

export const verifyAdminPassword = mutation({
  args: {
    password: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args): Promise<{ isFirstLogin: boolean }> => {
    // Per-business auth (multi-tenant)
    if (args.businessId) {
      const business = await ctx.db.get(args.businessId);
      if (!business) throw new Error("Business not found");
      if (business.isActive === false) throw new Error("Account suspended");

      // First-login path: match against temporaryPassword directly, skip adminPassword entirely.
      if (business.isFirstLogin !== false && business.temporaryPassword === args.password) {
        return { isFirstLogin: true };
      }

      // Normal login path: match against adminPassword only.
      const stored = business.adminPassword;
      if (!stored || stored !== args.password) throw new Error("סיסמה שגויה");

      return { isFirstLogin: business.isFirstLogin ?? false };
    }

    // Legacy single-tenant auth (global settings)
    const business = await ctx.db.query("businesses").first();
    if (business && business.isActive === false) throw new Error("Account suspended");

    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "adminPassword"))
      .unique();

    if ((setting?.value ?? DEFAULT_PASSWORD) !== args.password) throw new Error("סיסמה שגויה");

    const firstLoginSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "isFirstLogin"))
      .unique();

    return { isFirstLogin: firstLoginSetting?.value !== "false" };
  },
});

// ─── forceChangePasswordOnFirstLogin ─────────────────────────────────────────

export const forceChangePasswordOnFirstLogin = mutation({
  args: {
    newPassword: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args): Promise<void> => {
    if (!args.newPassword || args.newPassword.length < 4) {
      throw new Error("הסיסמה החדשה קצרה מדי");
    }

    // Per-business (multi-tenant)
    if (args.businessId) {
      await ctx.db.patch(args.businessId, {
        adminPassword: args.newPassword,
        isFirstLogin: false,
      });
      // Auto-seed services, barbers, gallery, and profile images from the template.
      // Idempotent — no-op if the business was already seeded during provision.
      await performSeedIfEmpty(ctx, args.businessId);
      return;
    }

    // Legacy global settings
    const passwordSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "adminPassword"))
      .unique();

    if (passwordSetting) {
      await ctx.db.patch(passwordSetting._id, { value: args.newPassword });
    } else {
      await ctx.db.insert("settings", { key: "adminPassword", value: args.newPassword });
    }

    const firstLoginSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "isFirstLogin"))
      .unique();

    if (firstLoginSetting) {
      await ctx.db.patch(firstLoginSetting._id, { value: "false" });
    } else {
      await ctx.db.insert("settings", { key: "isFirstLogin", value: "false" });
    }

    const existingBusiness = await ctx.db.query("businesses").first();
    if (!existingBusiness) {
      await ctx.db.insert("businesses", {
        name: { he: "הסלון שלי", ar: "صالوني" },
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
      });
    }
  },
});

// ─── updateAdminPassword ──────────────────────────────────────────────────────

export const updateAdminPassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args): Promise<void> => {
    if (!args.newPassword || args.newPassword.length < 4) {
      throw new Error("הסיסמה החדשה קצרה מדי");
    }

    // Per-business (multi-tenant)
    if (args.businessId) {
      const business = await ctx.db.get(args.businessId);
      if (!business) throw new Error("Business not found");

      const stored = business.adminPassword ?? business.temporaryPassword ?? DEFAULT_PASSWORD;
      if (stored !== args.currentPassword) throw new Error("סיסמה שגויה");

      await ctx.db.patch(args.businessId, {
        adminPassword: args.newPassword,
        isFirstLogin: false,
      });
      return;
    }

    // Legacy global settings
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "adminPassword"))
      .unique();

    const stored = setting?.value ?? DEFAULT_PASSWORD;
    if (stored !== args.currentPassword) throw new Error("סיסמה שגויה");

    if (setting) {
      await ctx.db.patch(setting._id, { value: args.newPassword });
    } else {
      await ctx.db.insert("settings", { key: "adminPassword", value: args.newPassword });
    }

    const firstLoginSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "isFirstLogin"))
      .unique();

    if (firstLoginSetting && firstLoginSetting.value !== "false") {
      await ctx.db.patch(firstLoginSetting._id, { value: "false" });
    } else if (!firstLoginSetting) {
      await ctx.db.insert("settings", { key: "isFirstLogin", value: "false" });
    }
  },
});
