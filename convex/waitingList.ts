import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { isValidPhone } from "./helpers";
import { requireBusinessSession } from "./authHelpers";

// ─── joinWaitingList ─────────────────────────────────────────────────────────

export const joinWaitingList = mutation({
  args: {
    businessId: v.id("businesses"),
    serviceId: v.optional(v.id("services")),
    date: v.string(),
    timePreference: v.union(
      v.literal("morning"),
      v.literal("evening"),
      v.literal("any")
    ),
    customerName: v.string(),
    customerPhone: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trimmedName  = args.customerName.trim();
    const trimmedPhone = args.customerPhone.trim();

    if (!trimmedName)             throw new Error("Customer name is required");
    if (!isValidPhone(trimmedPhone)) throw new Error("Invalid phone number format");

    // Prevent duplicate entries for the same customer on the same date.
    const existing = await ctx.db
      .query("waitingList")
      .withIndex("by_business_date", (q) =>
        q.eq("businessId", args.businessId).eq("date", args.date)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("customerPhone"), trimmedPhone),
          q.eq(q.field("status"), "waiting")
        )
      )
      .first();

    if (existing) {
      throw new Error("כבר נמצאת ברשימת ההמתנה לתאריך זה");
    }

    return await ctx.db.insert("waitingList", {
      businessId:     args.businessId,
      serviceId:      args.serviceId,
      date:           args.date,
      timePreference: args.timePreference,
      customerName:   trimmedName,
      customerPhone:  trimmedPhone,
      status:         "waiting",
      notes:          args.notes,
    });
  },
});

// ─── getForBusiness (admin) ──────────────────────────────────────────────────

export const getForBusiness = query({
  args: {
    token: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, { token, businessId }) => {
    await requireBusinessSession(ctx, token, businessId);
    const entries = await ctx.db
      .query("waitingList")
      .withIndex("by_business_date", (q) => q.eq("businessId", businessId))
      .order("asc")
      .take(300);

    return await enrichEntries(ctx, entries);
  },
});

// ─── getForCustomer ──────────────────────────────────────────────────────────

export const getForCustomer = query({
  args: { customerPhone: v.string() },
  handler: async (ctx, { customerPhone }) => {
    if (!customerPhone.trim()) return [];

    const entries = await ctx.db
      .query("waitingList")
      .withIndex("by_customer_phone", (q) =>
        q.eq("customerPhone", customerPhone.trim())
      )
      .order("desc")
      .take(50);

    return await Promise.all(
      entries.map(async (entry) => {
        const [barber, service, business] = await Promise.all([
          entry.barberId  ? ctx.db.get(entry.barberId)  : null,
          entry.serviceId ? ctx.db.get(entry.serviceId) : null,
          ctx.db.get(entry.businessId),
        ]);
        return { ...entry, barber, service, business };
      })
    );
  },
});

// ─── cancelEntry (customer cancels their own entry) ──────────────────────────

export const cancelEntry = mutation({
  args: {
    entryId:       v.id("waitingList"),
    customerPhone: v.string(),
  },
  handler: async (ctx, { entryId, customerPhone }) => {
    const entry = await ctx.db.get(entryId);
    if (!entry) throw new Error("Entry not found");
    if (entry.customerPhone !== customerPhone.trim()) throw new Error("Unauthorized");
    await ctx.db.patch(entryId, { status: "expired" });
    return { success: true };
  },
});

// ─── removeEntry (admin removes any entry) ───────────────────────────────────

export const removeEntry = mutation({
  args: { token: v.string(), entryId: v.id("waitingList") },
  handler: async (ctx, { token, entryId }) => {
    const entry = await ctx.db.get(entryId);
    if (!entry) throw new Error("Entry not found");
    await requireBusinessSession(ctx, token, entry.businessId);
    await ctx.db.delete(entryId);
    return { success: true };
  },
});

// ─── markNotified (internal) ─────────────────────────────────────────────────

export const markNotified = internalMutation({
  args: { entryId: v.id("waitingList") },
  handler: async (ctx, { entryId }) => {
    await ctx.db.patch(entryId, { status: "notified" });
  },
});

// ─── getWaitingEntries (internal) ────────────────────────────────────────────

export const getWaitingEntries = internalQuery({
  args: {
    businessId: v.id("businesses"),
    date:       v.string(),
  },
  handler: async (ctx, { businessId, date }) => {
    const [entries, business] = await Promise.all([
      ctx.db
        .query("waitingList")
        .withIndex("by_business_date_status", (q) =>
          q.eq("businessId", businessId).eq("date", date).eq("status", "waiting")
        )
        .order("asc") // FIFO
        .take(50),
      ctx.db.get(businessId),
    ]);

    return { entries, business };
  },
});

// ─── processDateWaitingList (internal action) ─────────────────────────────────
// Fires after an appointment cancellation. Notifies all "waiting" entries for
// that date via WhatsApp so the first to book wins.

export const processDateWaitingList = internalAction({
  args: {
    businessId: v.id("businesses"),
    date:       v.string(),
  },
  handler: async (ctx, { businessId, date }): Promise<void> => {
    const { entries, business } = (await ctx.runQuery(
      internal.waitingList.getWaitingEntries,
      { businessId, date }
    )) as { entries: Doc<"waitingList">[]; business: Doc<"businesses"> | null };

    if (entries.length === 0) return;

    const [year, month, day] = date.split("-").map(Number);
    const dateLabel = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
      "he-IL",
      { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }
    );

    const bizName  = business?.name?.he ?? "";
    const salonUrl = business?.salonLink ?? (business?.slug ? `/salon/${business.slug}` : "");

    for (const entry of entries) {
      const linkPart = salonUrl ? ` לקביעת תור: ${salonUrl}` : "";
      const message =
        `היי ${entry.customerName}! 📅 ` +
        `נפתח מקום פנוי${bizName ? ` ב${bizName}` : ""} לתאריך ${dateLabel}. ` +
        `מהירה זוכה!${linkPart} 💖`;

      if (entry.customerPhone === "1234") {
        console.log("📱 [WaitingList TEST MODE] ➜", message);
      } else {
        console.log(`📱 [WaitingList SIMULATED] ➜ ${entry.customerPhone}: ${message}`);
        // TODO: replace with a real provider, e.g. Twilio:
        // await fetch("https://api.twilio.com/...", { method: "POST", body: ... });
      }

      await ctx.runMutation(internal.waitingList.markNotified, {
        entryId: entry._id,
      });
    }
  },
});

// ─── helpers ─────────────────────────────────────────────────────────────────

async function enrichEntries(
  ctx: QueryCtx,
  entries: Doc<"waitingList">[]
) {
  return await Promise.all(
    entries.map(async (entry) => {
      const [barber, service] = await Promise.all([
        entry.barberId  ? ctx.db.get(entry.barberId)  : null,
        entry.serviceId ? ctx.db.get(entry.serviceId) : null,
      ]);
      return { ...entry, barber, service };
    })
  );
}
