import { mutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_PASSWORD = "admin10";

// ─── verifyAdminPassword ──────────────────────────────────────────────────────
// Returns { isFirstLogin } on success; throws on wrong password or suspension.

export const verifyAdminPassword = mutation({
  args: { password: v.string() },
  handler: async (ctx, args): Promise<{ isFirstLogin: boolean }> => {
    // Reject if the business has been suspended
    const business = await ctx.db.query("businesses").first();
    if (business && business.isActive === false) {
      throw new Error("Account suspended");
    }

    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "adminPassword"))
      .unique();

    if ((setting?.value ?? DEFAULT_PASSWORD) !== args.password) {
      throw new Error("סיסמה שגויה");
    }

    // isFirstLogin defaults to true until explicitly set to "false"
    const firstLoginSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "isFirstLogin"))
      .unique();

    const isFirstLogin = firstLoginSetting?.value !== "false";
    return { isFirstLogin };
  },
});

// ─── forceChangePasswordOnFirstLogin ─────────────────────────────────────────
// Called after first-login verification; no current-password check needed.
// Also bootstraps the business row if one does not exist yet.

export const forceChangePasswordOnFirstLogin = mutation({
  args: { newPassword: v.string() },
  handler: async (ctx, args): Promise<void> => {
    if (!args.newPassword || args.newPassword.length < 4) {
      throw new Error("הסיסמה החדשה קצרה מדי");
    }

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

    // Bootstrap the business row for this hairdresser if it doesn't exist yet.
    // The admin page requires at least one business to be present.
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
// Regular password change (requires current password). Also clears isFirstLogin.

export const updateAdminPassword = mutation({
  args: { currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "adminPassword"))
      .unique();
    const stored = setting?.value ?? DEFAULT_PASSWORD;
    if (stored !== args.currentPassword) {
      throw new Error("סיסמה שגויה");
    }
    if (!args.newPassword || args.newPassword.length < 4) {
      throw new Error("הסיסמה החדשה קצרה מדי");
    }
    if (setting) {
      await ctx.db.patch(setting._id, { value: args.newPassword });
    } else {
      await ctx.db.insert("settings", { key: "adminPassword", value: args.newPassword });
    }

    // Clear isFirstLogin if still pending
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
