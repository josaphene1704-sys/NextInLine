"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Polar } from "@polar-sh/sdk";
import { POLAR_PRODUCTS, PolarProductKey } from "./polarProducts";

function polarClient(): Polar {
  const accessToken = process.env.POLAR_ORGANIZATION_TOKEN;
  if (!accessToken) throw new Error("POLAR_ORGANIZATION_TOKEN is not configured");
  // POLAR_SERVER: "sandbox" | "production" (defaults to production when unset).
  const server = process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production";
  return new Polar({ accessToken, server });
}

/**
 * Create a Polar checkout session for a given product (basic/premium plans or
 * the one-time extras) and return its hosted checkout URL.
 *
 * Session-gated: the caller must hold a valid admin session for `businessId`.
 * The business id is attached as the Polar external customer id + metadata so
 * the webhook can map the resulting order/subscription back to this salon.
 */
export const createCheckout = action({
  args: {
    token: v.string(),
    businessId: v.id("businesses"),
    product: v.union(
      v.literal("basic"),
      v.literal("premium"),
      v.literal("extraBasic"),
      v.literal("extraPremium"),
    ),
    successUrl: v.string(),
  },
  handler: async (ctx, { token, businessId, product, successUrl }): Promise<{ url: string }> => {
    // Authorize against the same session model the rest of the admin uses.
    const ok = await ctx.runQuery(api.settings.validateSession, { token, businessId });
    if (!ok) throw new Error("Unauthorized");

    const def = POLAR_PRODUCTS[product as PolarProductKey];
    const polar = polarClient();

    // For subscription plans, align a Polar free-trial to whatever is left of
    // the salon's app-side trial so no card is charged until the original
    // trialEndsAt. Once the trial is over (or for one-time extras) we bill now.
    let trial: { trialInterval: "day"; trialIntervalCount: number } | { allowTrial: false } | {} = {};
    if (def.kind === "subscription") {
      const billing = await ctx.runQuery(api.businesses.getBillingStatus, { token, businessId });
      const remainingDays = billing.status === "trial" ? (billing.daysRemaining ?? 0) : 0;
      trial = remainingDays > 0
        ? { trialInterval: "day", trialIntervalCount: remainingDays }
        : { allowTrial: false };
    }

    const checkout = await polar.checkouts.create({
      products: [def.id],
      successUrl,
      externalCustomerId: businessId,
      metadata: { businessId, product },
      ...trial,
    });

    return { url: checkout.url };
  },
});
