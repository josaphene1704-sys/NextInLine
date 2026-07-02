import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-off data migration: rewrite stored Convex-storage URLs from one
 * deployment origin to another (used when moving data dev → prod, since
 * snapshot import preserves storage UUIDs but businesses/barbers store
 * absolute URLs captured at upload time).
 *
 * Run from the CLI, e.g.:
 *   npx convex run --prod migrations:rewriteStorageDomains \
 *     '{"from":"https://old.convex.cloud","to":"https://new.convex.cloud"}'
 *
 * Idempotent — URLs that don't start with `from` are left untouched.
 */
export const rewriteStorageDomains = internalMutation({
  args: { from: v.string(), to: v.string() },
  returns: v.object({ businesses: v.number(), barbers: v.number() }),
  handler: async (ctx, { from, to }) => {
    const swap = (url: string | undefined): string | undefined =>
      url && url.startsWith(from) ? to + url.slice(from.length) : undefined;

    let businessCount = 0;
    const businesses = await ctx.db.query("businesses").take(500);
    for (const b of businesses) {
      const patch: Record<string, string> = {};
      const logo = swap(b.logoUrl);
      const image = swap(b.imageUrl);
      if (logo) patch.logoUrl = logo;
      if (image) patch.imageUrl = image;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(b._id, patch);
        businessCount++;
      }
    }

    let barberCount = 0;
    const barbers = await ctx.db.query("barbers").take(500);
    for (const barber of barbers) {
      const avatar = swap(barber.avatarUrl);
      if (avatar) {
        await ctx.db.patch(barber._id, { avatarUrl: avatar });
        barberCount++;
      }
    }

    return { businesses: businessCount, barbers: barberCount };
  },
});
