/**
 * Resolves "the sole barber" for a single-operator business.
 * DB-dependent (like authHelpers.ts), so kept in its own file.
 *
 * The `barbers` table/relations are intentionally kept in the schema (not
 * removed) so appointments/specialSchedules/waitingList keep working
 * unchanged — this just removes the need for a client to ever pick one.
 */

import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

/** Deterministic tie-break when a business somehow has more than one barber. */
function pickPrimary(barbers: Doc<"barbers">[]): Doc<"barbers"> {
  return barbers.find((b) => b.isActive) ?? barbers[0];
}

/**
 * Fetch-or-lazily-create variant, for mutation call sites. Defensive against
 * businesses provisioned before this helper existed (0 barbers) — always
 * returns a barber without requiring a manual data migration.
 */
export async function getSoleBarber(
  ctx: MutationCtx,
  businessId: Id<"businesses">
): Promise<Doc<"barbers">> {
  const barbers = await ctx.db
    .query("barbers")
    .withIndex("by_business", (q) => q.eq("businessId", businessId))
    .collect();

  if (barbers.length > 0) return pickPrimary(barbers);

  const business = await ctx.db.get(businessId);
  if (!business) throw new Error("Business not found");

  const barberId = await ctx.db.insert("barbers", {
    businessId,
    name: business.name,
    role: { he: "בעל/ת העסק", ar: "صاحب/ة العمل" },
    specializedServices: [],
    isActive: true,
  });
  const barber = await ctx.db.get(barberId);
  if (!barber) throw new Error("Failed to create default barber");
  return barber;
}

/**
 * Read-only variant, for query call sites (queries cannot insert). Throws if
 * the business has no barber yet — steady-state businesses always have one
 * because `provision()` guarantees it and every write path uses the
 * lazy-create variant above.
 */
export async function getSoleBarberReadonly(
  ctx: QueryCtx,
  businessId: Id<"businesses">
): Promise<Doc<"barbers">> {
  const barbers = await ctx.db
    .query("barbers")
    .withIndex("by_business", (q) => q.eq("businessId", businessId))
    .collect();

  if (barbers.length === 0) {
    throw new Error("No barber configured for this business yet");
  }
  return pickPrimary(barbers);
}
