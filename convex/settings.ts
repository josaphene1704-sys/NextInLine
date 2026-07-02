import { internalMutation, mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { performSeedIfEmpty } from "./businesses";
import { issueSession, invalidateBusinessSessions, requireBusinessSession } from "./authHelpers";

// Legacy single-tenant fallback password. Must be set via `npx convex env set
// LEGACY_ADMIN_DEFAULT_PASSWORD ...` — fails closed (no hardcoded default) if unset.
const DEFAULT_PASSWORD = process.env.LEGACY_ADMIN_DEFAULT_PASSWORD;

// ─── verifyAdminPassword ──────────────────────────────────────────────────────

export const verifyAdminPassword = mutation({
  args: {
    password: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args): Promise<{ isFirstLogin: boolean; token?: string }> => {
    // Per-business auth (multi-tenant)
    if (args.businessId) {
      const business = await ctx.db.get(args.businessId);
      if (!business) throw new ConvexError("Business not found");
      if (business.isActive === false) throw new ConvexError("Account suspended");

      // First-login path: match against temporaryPassword directly, skip adminPassword entirely.
      // No token yet — the client must go through activateAndSetPassword next, which issues one.
      if (business.isFirstLogin !== false && business.temporaryPassword === args.password) {
        return { isFirstLogin: true };
      }

      // Normal login path: match against adminPassword only.
      const stored = business.adminPassword;
      if (!stored || stored !== args.password) throw new ConvexError("סיסמה שגויה");

      const token = await issueSession(ctx, "admin", args.businessId);
      return { isFirstLogin: business.isFirstLogin ?? false, token };
    }

    // Legacy single-tenant auth (global settings)
    const business = await ctx.db.query("businesses").first();
    if (business && business.isActive === false) throw new ConvexError("Account suspended");

    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "adminPassword"))
      .unique();

    const expected = setting?.value ?? DEFAULT_PASSWORD;
    if (!expected || expected !== args.password) throw new ConvexError("סיסמה שגויה");

    const firstLoginSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "isFirstLogin"))
      .unique();

    const isFirstLogin = firstLoginSetting?.value !== "false";
    if (isFirstLogin) return { isFirstLogin: true };

    // Legacy path has no businessId, so this token can't satisfy
    // requireBusinessSession for any real business — only useful if a legacy
    // mutation is ever added that accepts a businessId-less "admin" session.
    const token = await issueSession(ctx, "admin", undefined);
    return { isFirstLogin: false, token };
  },
});

// ─── forceChangePasswordOnFirstLogin ─────────────────────────────────────────
// No client component calls this (activateAndSetPassword is the wired-up,
// atomically-verified path). Kept as an internalMutation only — not
// client-callable — since it sets a password with no re-verification.

export const forceChangePasswordOnFirstLogin = internalMutation({
  args: {
    newPassword: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args): Promise<void> => {
    if (!args.newPassword || args.newPassword.length < 4) {
      throw new ConvexError("הסיסמה החדשה קצרה מדי");
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

// ─── activateAndSetPassword ───────────────────────────────────────────────────
//
// Atomic first-login activation + password change.
//
// Security model:
//   • Verify + write happen inside a single Convex transaction — no TOCTOU gap.
//   • currentPassword is checked server-side; the client cannot skip this step.
//   • Works for both first-login (temp password) and regular password change.
//   • forceChangePasswordOnFirstLogin is kept for backward compat but should
//     no longer be called from the client for sensitive flows.

export const activateAndSetPassword = mutation({
  args: {
    businessId: v.id("businesses"),
    currentPassword: v.string(),
    newPassword: v.string(),
    // Optional profile fields updated atomically in the same transaction
    nameHe: v.optional(v.string()),
    nameAr: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { businessId, currentPassword, newPassword, nameHe, nameAr, phone, address }
  ): Promise<{ wasFirstLogin: boolean; token: string }> => {
    // 1. Load — never trust a client-supplied identity claim.
    const business = await ctx.db.get(businessId);
    if (!business) throw new ConvexError("מספרה לא נמצאה");
    if (business.isActive === false) throw new ConvexError("החשבון מושהה");

    // 2. Decide which stored secret to compare against.
    //    First-login → accept temporaryPassword.
    //    Subsequent change → accept current adminPassword.
    const isFirstLogin = business.isFirstLogin !== false;
    const expected = isFirstLogin
      ? business.temporaryPassword
      : business.adminPassword;

    if (!expected || expected !== currentPassword) {
      throw new ConvexError("הסיסמה הנוכחית שגויה");
    }

    // 3. Validate the new password before touching the DB.
    if (!newPassword || newPassword.length < 6) {
      throw new ConvexError("הסיסמה החדשה חייבת להכיל לפחות 6 תווים");
    }
    if (newPassword === currentPassword) {
      throw new ConvexError("הסיסמה החדשה חייבת להיות שונה מהנוכחית");
    }

    // 4. Build the patch — only include profile fields that were actually sent.
    const patch: Record<string, unknown> = {
      adminPassword: newPassword,
      isFirstLogin: false,
    };
    if (nameHe !== undefined || nameAr !== undefined) {
      patch.name = {
        he: nameHe ?? business.name.he,
        ar: nameAr ?? business.name.ar,
      };
    }
    if (phone !== undefined)   patch.phone   = phone;
    if (address !== undefined) patch.address = address;

    await ctx.db.patch(businessId, patch);

    // 5. Seed services/barbers/gallery on first activation only.
    if (isFirstLogin) {
      await performSeedIfEmpty(ctx, businessId);
    }

    // 6. Rotate sessions: kill any stale tokens from before this password
    //    change, then issue a fresh one for the caller.
    await invalidateBusinessSessions(ctx, businessId);
    const token = await issueSession(ctx, "admin", businessId);

    return { wasFirstLogin: isFirstLogin, token };
  },
});

// ─── verifyMasterPassword ────────────────────────────────────────────────────

// Must be set via `npx convex env set BOSS_MASTER_PASSWORD ...` — fails
// closed (no hardcoded default) if unset.
const MASTER_PASSWORD = process.env.BOSS_MASTER_PASSWORD;

export const verifyMasterPassword = mutation({
  args: { password: v.string() },
  handler: async (ctx, { password }) => {
    if (!MASTER_PASSWORD) throw new ConvexError("Master password is not configured");
    if (password !== MASTER_PASSWORD) throw new ConvexError("סיסמה שגויה");
    const token = await issueSession(ctx, "boss");
    return { ok: true, token };
  },
});

// ─── updateAdminPassword ──────────────────────────────────────────────────────

export const updateAdminPassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args): Promise<{ token?: string }> => {
    if (!args.newPassword || args.newPassword.length < 4) {
      throw new ConvexError("הסיסמה החדשה קצרה מדי");
    }

    // Per-business (multi-tenant)
    if (args.businessId) {
      const business = await ctx.db.get(args.businessId);
      if (!business) throw new ConvexError("Business not found");

      const stored = business.adminPassword ?? business.temporaryPassword ?? DEFAULT_PASSWORD;
      if (!stored || stored !== args.currentPassword) throw new ConvexError("סיסמה שגויה");

      await ctx.db.patch(args.businessId, {
        adminPassword: args.newPassword,
        isFirstLogin: false,
      });

      // Rotate sessions: kill stale tokens, re-issue one for the caller so
      // they aren't logged out by their own password change.
      await invalidateBusinessSessions(ctx, args.businessId);
      const token = await issueSession(ctx, "admin", args.businessId);
      return { token };
    }

    // Legacy global settings
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "adminPassword"))
      .unique();

    const stored = setting?.value ?? DEFAULT_PASSWORD;
    if (!stored || stored !== args.currentPassword) throw new ConvexError("סיסמה שגויה");

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

    return {};
  },
});

// ─── validateSession ──────────────────────────────────────────────────────────
//
// Reactive boolean check for whether a session token is still valid for a given
// business. Returns a boolean (never throws) because Convex redacts Error
// messages in production — the client must not rely on error-message sniffing.
// Being a query over the `sessions` table, it flips to `false` the instant the
// session row is deleted (e.g. password rotation), so open admin tabs get
// kicked to login live.

export const validateSession = query({
  args: { token: v.string(), businessId: v.id("businesses") },
  returns: v.boolean(),
  handler: async (ctx, { token, businessId }): Promise<boolean> => {
    try {
      await requireBusinessSession(ctx, token, businessId);
      return true;
    } catch {
      return false;
    }
  },
});

// ─── invalidateSession (logout) ───────────────────────────────────────────────

export const invalidateSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (session) await ctx.db.delete(session._id);
    return { success: true };
  },
});
