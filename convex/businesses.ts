import { internalMutation, mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireBossSession, requireBusinessSession } from "./authHelpers";
import { getSoleBarber } from "./barberHelpers";
import { isSubscriptionActive } from "./helpers";

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Strips credential fields before a business doc is returned to a client. */
function toPublicBusiness<T extends { temporaryPassword?: string; adminPassword?: string }>(
  business: T | null
) {
  if (!business) return null;
  const { temporaryPassword: _tp, adminPassword: _ap, ...safe } = business;
  return safe;
}

export const getById = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    return toPublicBusiness(await ctx.db.get(businessId));
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const businesses = await ctx.db.query("businesses").take(200);
    return businesses.map(({ temporaryPassword: _tp, adminPassword: _ap, ...safe }) => safe);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    const safe = toPublicBusiness(business);
    if (!safe) return null;
    // Computed server-side so the booking page can gate on a valid subscription
    // without duplicating the expiry logic on the client.
    return { ...safe, subscriptionActive: isSubscriptionActive(safe) };
  },
});

// ─── Internal clone helpers ───────────────────────────────────────────────────

/**
 * Clones all services from `templateId` into `targetId`.
 * Returns a map of old serviceId → new serviceId so barbers/gallery can be remapped.
 */
async function cloneServices(
  ctx: any,
  templateId: Id<"businesses">,
  targetId: Id<"businesses">
): Promise<Record<string, Id<"services">>> {
  const templateServices = await ctx.db
    .query("services")
    .withIndex("by_business", (q: any) => q.eq("businessId", templateId))
    .take(100);

  const idMap: Record<string, Id<"services">> = {};
  for (const svc of templateServices) {
    const { _id, _creationTime, businessId: _bid, ...rest } = svc;
    const newId = await ctx.db.insert("services", { ...rest, businessId: targetId });
    idMap[_id] = newId;
  }
  return idMap;
}

/**
 * Clones the primary (single-operator) barber from `templateId` into
 * `targetId`, remapping specializedServices using `serviceIdMap`.
 * Never clones more than one barber, even if the template has several.
 */
async function cloneBarbers(
  ctx: any,
  templateId: Id<"businesses">,
  targetId: Id<"businesses">,
  serviceIdMap: Record<string, Id<"services">>
): Promise<void> {
  const templateBarbers = await ctx.db
    .query("barbers")
    .withIndex("by_business", (q: any) => q.eq("businessId", templateId))
    .take(50);

  if (templateBarbers.length === 0) return;
  const primary = templateBarbers.find((b: any) => b.isActive) ?? templateBarbers[0];

  const { _id, _creationTime, businessId: _bid, specializedServices, ...rest } = primary;
  const newSpecialized = specializedServices
    .map((sid: string) => serviceIdMap[sid])
    .filter((id: Id<"services"> | undefined): id is Id<"services"> => id !== undefined);
  await ctx.db.insert("barbers", {
    ...rest,
    businessId: targetId,
    specializedServices: newSpecialized,
  });
}

/**
 * Clones gallery photos from `templateId` into `targetId`.
 * storageId values are shared (Convex storage is global); serviceId is remapped.
 */
async function cloneGallery(
  ctx: any,
  templateId: Id<"businesses">,
  targetId: Id<"businesses">,
  serviceIdMap: Record<string, Id<"services">>
): Promise<void> {
  const photos = await ctx.db
    .query("gallery")
    .withIndex("by_business", (q: any) => q.eq("businessId", templateId))
    .take(200);

  for (const photo of photos) {
    const { _id, _creationTime, businessId: _bid, serviceId, ...rest } = photo;
    await ctx.db.insert("gallery", {
      ...rest,
      businessId: targetId,
      serviceId: serviceId ? (serviceIdMap[serviceId] ?? undefined) : undefined,
    });
  }
}

/** Hardcoded fallback when no template business exists yet. */
async function seedHardcodedDefaults(
  ctx: any,
  businessId: Id<"businesses">,
  nameHe: string
): Promise<void> {
  const s1 = await ctx.db.insert("services", {
    businessId,
    name: { he: "תספורת", ar: "قصة شعر" },
    description: { he: "תספורת מקצועית", ar: "قصة شعر احترافية" },
    duration: 30,
    price: 5000,
    isActive: true,
  });
  const s2 = await ctx.db.insert("services", {
    businessId,
    name: { he: "תספורת + זקן", ar: "قصة شعر ولحية" },
    description: { he: "תספורת ועיצוב זקן", ar: "قصة شعر وتشكيل لحية" },
    duration: 45,
    price: 7000,
    isActive: true,
  });
  const s3 = await ctx.db.insert("services", {
    businessId,
    name: { he: "צביעה", ar: "صباغة" },
    description: { he: "צביעת שיער מקצועית", ar: "صباغة شعر احترافية" },
    duration: 90,
    price: 15000,
    isActive: true,
  });
  const s4 = await ctx.db.insert("services", {
    businessId,
    name: { he: "טיפול שיער", ar: "علاج الشعر" },
    description: { he: "טיפול שיער מזין ומשקם", ar: "علاج مغذٍ ومرمم للشعر" },
    duration: 60,
    price: 12000,
    isActive: true,
  });
  await ctx.db.insert("barbers", {
    businessId,
    name: { he: nameHe, ar: nameHe },
    role: { he: "בעל העסק", ar: "صاحب العمل" },
    specializedServices: [s1, s2, s3, s4],
    isActive: true,
  });
}

/**
 * Finds the designated template business.
 * Prefers a business with isTemplate:true; falls back to the oldest business
 * that isn't the one being initialized.
 */
async function findTemplateBusiness(
  ctx: any,
  excludeId: Id<"businesses">
): Promise<any | null> {
  const tagged = await ctx.db
    .query("businesses")
    .withIndex("by_template", (q: any) => q.eq("isTemplate", true))
    .first();
  if (tagged && tagged._id !== excludeId) return tagged;

  const all = await ctx.db.query("businesses").take(20);
  return all.find((b: any) => b._id !== excludeId) ?? null;
}

/**
 * Core seeding logic: clones services, barbers, gallery, logoUrl, and imageUrl
 * from the template business into the given business.
 * Idempotent — skips entirely if the business already has services.
 *
 * Exported so settings.ts can call it during the first-login password change.
 */
export async function performSeedIfEmpty(
  ctx: any,
  businessId: Id<"businesses">
): Promise<{ seeded: boolean; source?: string }> {
  const business = await ctx.db.get(businessId);
  if (!business) throw new Error("Business not found");

  const existingServices = await ctx.db
    .query("services")
    .withIndex("by_business", (q: any) => q.eq("businessId", businessId))
    .take(1);
  if (existingServices.length > 0) return { seeded: false };

  const template = await findTemplateBusiness(ctx, businessId);

  if (template) {
    const templateHasServices = await ctx.db
      .query("services")
      .withIndex("by_business", (q: any) => q.eq("businessId", template._id))
      .take(1);

    if (templateHasServices.length > 0) {
      const serviceIdMap = await cloneServices(ctx, template._id, businessId);

      const existingBarbers = await ctx.db
        .query("barbers")
        .withIndex("by_business", (q: any) => q.eq("businessId", businessId))
        .take(1);
      if (existingBarbers.length === 0) {
        await cloneBarbers(ctx, template._id, businessId, serviceIdMap);
      }

      await cloneGallery(ctx, template._id, businessId, serviceIdMap);

      const patch: Record<string, any> = {
        workingHours: template.workingHours,
        timezone: template.timezone ?? "Asia/Jerusalem",
      };
      if (template.logoUrl)  patch.logoUrl  = template.logoUrl;
      if (template.imageUrl) patch.imageUrl = template.imageUrl;
      await ctx.db.patch(businessId, patch);

      return { seeded: true, source: "template" };
    }
  }

  await seedHardcodedDefaults(ctx, businessId, business.name.he);
  return { seeded: true, source: "defaults" };
}

// ─── provision ────────────────────────────────────────────────────────────────

export const provision = mutation({
  args: {
    token: v.string(),
    slug: v.string(),
    nameHe: v.string(),
  },
  handler: async (ctx, { token, slug, nameHe }) => {
    await requireBossSession(ctx, token);

    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) throw new ConvexError(`הסלאג "${slug}" כבר קיים במערכת`);

    // Find the template BEFORE inserting the new business.
    const tagged = await ctx.db
      .query("businesses")
      .withIndex("by_template", (q: any) => q.eq("isTemplate", true))
      .first();
    const template = tagged ?? await ctx.db.query("businesses").first();

    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let tempPassword = "";
    for (let i = 0; i < 8; i++) {
      tempPassword += chars[Math.floor(Math.random() * chars.length)];
    }

    const baseUrl = process.env.SITE_URL ?? "https://next-in-line-teal.vercel.app";
    const salonLink = `${baseUrl}/salon/${slug}`;

    const businessId = await ctx.db.insert("businesses", {
      slug,
      name: { he: nameHe, ar: nameHe },
      description: { he: "", ar: "" },
      address: "",
      phone: "",
      workingHours: template?.workingHours ?? {
        daySchedules: [
          { day: 0, start: "09:00", end: "19:00" },
          { day: 1, start: "09:00", end: "19:00" },
          { day: 2, start: "09:00", end: "19:00" },
          { day: 3, start: "09:00", end: "19:00" },
          { day: 4, start: "09:00", end: "19:00" },
        ],
        slotIntervalMinutes: 30,
      },
      timezone: template?.timezone ?? "Asia/Jerusalem",
      logoUrl: template?.logoUrl,
      imageUrl: template?.imageUrl,
      isActive: true,
      temporaryPassword: tempPassword,
      salonLink,
      adminPassword: tempPassword,
      isFirstLogin: true,
      subscriptionStatus: "trial",
      trialEndsAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
    });

    if (template) {
      const serviceIdMap = await cloneServices(ctx, template._id, businessId);
      await cloneBarbers(ctx, template._id, businessId, serviceIdMap);
      await cloneGallery(ctx, template._id, businessId, serviceIdMap);
    } else {
      await seedHardcodedDefaults(ctx, businessId, nameHe);
    }

    // Belt-and-suspenders: guarantee exactly one barber exists regardless of
    // template/seed state (requirement: every business gets a default barber).
    await getSoleBarber(ctx, businessId);

    return { businessId, temporaryPassword: tempPassword, salonLink };
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

// Boss-gated as defense in depth — no client UI calls this today (provision
// is the wired-up path for creating a new salon).
export const create = mutation({
  args: {
    token: v.string(),
    name: v.object({ he: v.string(), ar: v.string() }),
    description: v.object({ he: v.string(), ar: v.string() }),
    address: v.string(),
    phone: v.string(),
    logoUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    workingHours: workingHoursArg,
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...args }) => {
    await requireBossSession(ctx, token);
    return await ctx.db.insert("businesses", args);
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    businessId: v.id("businesses"),
    name: v.optional(v.object({ he: v.string(), ar: v.string() })),
    description: v.optional(v.object({ he: v.string(), ar: v.string() })),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    workingHours: v.optional(workingHoursArg),
    timezone: v.optional(v.string()),
    announcement: v.optional(v.string()),
  },
  handler: async (ctx, { token, businessId, ...fields }) => {
    const existing = await ctx.db.get(businessId);
    if (!existing) throw new Error("Business not found");
    await requireBusinessSession(ctx, token, businessId);

    const patch: Record<string, unknown> = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );

    // Empty string ⇒ explicit "remove". Patching a field to `undefined`
    // unsets it, so the optional field disappears rather than storing "".
    if (fields.logoUrl === "")  patch.logoUrl  = undefined;
    if (fields.imageUrl === "") patch.imageUrl = undefined;
    if (fields.announcement === "") patch.announcement = undefined;

    await ctx.db.patch(businessId, patch);
    return { success: true };
  },
});

export const setIsActive = mutation({
  args: { token: v.string(), businessId: v.id("businesses"), isActive: v.boolean() },
  handler: async (ctx, { token, businessId, isActive }) => {
    const existing = await ctx.db.get(businessId);
    if (!existing) throw new Error("Business not found");
    await requireBusinessSession(ctx, token, businessId);
    await ctx.db.patch(businessId, { isActive });
    return { success: true };
  },
});

/**
 * Public wrapper around performSeedIfEmpty — kept for manual use from the
 * Convex dashboard if ever needed. The normal path is automatic (first login).
 * Safe to call repeatedly — no-op if services already exist.
 * Boss-gated as defense in depth (no client UI calls this).
 */
export const seedDefaultsIfEmpty = mutation({
  args: { token: v.string(), businessId: v.id("businesses") },
  handler: async (ctx, { token, businessId }) => {
    await requireBossSession(ctx, token);
    return await performSeedIfEmpty(ctx, businessId);
  },
});

/**
 * Marks a business as the authoritative template for new-tenant seeding.
 * Call this once from the Convex dashboard on your master salon record.
 * Clears the flag from any previously-tagged business first.
 * Boss-gated as defense in depth (no client UI calls this).
 */
export const setAsTemplate = mutation({
  args: { token: v.string(), businessId: v.id("businesses") },
  handler: async (ctx, { token, businessId }) => {
    await requireBossSession(ctx, token);

    const business = await ctx.db.get(businessId);
    if (!business) throw new Error("Business not found");

    const previously = await ctx.db
      .query("businesses")
      .withIndex("by_template", (q: any) => q.eq("isTemplate", true))
      .collect();
    for (const b of previously) await ctx.db.patch(b._id, { isTemplate: false });

    await ctx.db.patch(businessId, { isTemplate: true });
    return { success: true };
  },
});

/**
 * Sets (or changes) the URL slug of an existing business. There is otherwise no
 * way to give a slug to a business created without one — notably the template
 * salon, which is left slug-less by default so it isn't reached by accident.
 * Rejects a slug already taken by another business.
 * Admin-only (internalMutation) — run from the CLI/dashboard, no client UI.
 */
export const setSlug = internalMutation({
  args: { businessId: v.id("businesses"), slug: v.string() },
  handler: async (ctx, { businessId, slug }) => {
    const business = await ctx.db.get(businessId);
    if (!business) throw new Error("Business not found");

    const clash = await ctx.db
      .query("businesses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (clash && clash._id !== businessId) {
      throw new Error(`Slug "${slug}" is already taken by another business`);
    }

    await ctx.db.patch(businessId, { slug });
    return { success: true, slug };
  },
});

// ─── Billing / subscription ───────────────────────────────────────────────────

export const getBillingStatus = query({
  args: { token: v.string(), businessId: v.id("businesses") },
  handler: async (ctx, { token, businessId }) => {
    await requireBusinessSession(ctx, token, businessId);

    const business = await ctx.db.get(businessId);
    if (!business) throw new Error("Business not found");

    const status = business.subscriptionStatus ?? "trial";
    const trialEndsAt = business.trialEndsAt ?? null;
    const daysRemaining = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / 86_400_000))
      : null;

    return {
      status,
      trialEndsAt,
      daysRemaining,
      isTrialExpired: status === "trial" && trialEndsAt !== null && trialEndsAt < Date.now(),
      // True when the dashboard must be blocked behind an upgrade screen.
      accessBlocked: !isSubscriptionActive(business),
    };
  },
});

/**
 * Applies a subscription status change from a payment provider webhook.
 * Internal-only — no client can call this directly. A future webhook-handling
 * action (verifying the provider's signature) should call this via
 * ctx.runMutation(internal.businesses.applySubscriptionUpdate, {...}).
 */
export const applySubscriptionUpdate = internalMutation({
  args: {
    businessId: v.id("businesses"),
    subscriptionStatus: v.union(
      v.literal("trial"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("cancelled"),
    ),
    subscriptionId: v.optional(v.string()),
    customerToken: v.optional(v.string()),
  },
  handler: async (ctx, { businessId, subscriptionStatus, subscriptionId, customerToken }) => {
    const patch: Record<string, unknown> = { subscriptionStatus };
    if (subscriptionId !== undefined) patch.subscriptionId = subscriptionId;
    if (customerToken !== undefined) patch.customerToken = customerToken;
    await ctx.db.patch(businessId, patch);
  },
});
