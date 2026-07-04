import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { PRODUCT_BY_ID } from "./polarProducts";

// ─── helpers ───────────────────────────────────────────────────────────────

/** Polar subscription.status → our internal subscriptionStatus union. */
function mapSubscriptionStatus(
  polarStatus: unknown,
): "trial" | "active" | "past_due" | "cancelled" | null {
  switch (polarStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "cancelled":
    case "revoked":
      return "cancelled";
    default:
      return null;
  }
}

/**
 * Recover our businessId from a Polar payload. We attach it two ways at
 * checkout time (metadata.businessId + external customer id), and read from
 * whichever the event carries. Handles both camelCase and snake_case shapes.
 */
function resolveBusinessId(data: any): string | null {
  return (
    data?.metadata?.businessId ??
    data?.customer?.externalId ??
    data?.customer?.external_id ??
    data?.externalCustomerId ??
    data?.external_customer_id ??
    data?.customerExternalId ??
    null
  );
}

/** Find the Polar product id referenced by an order/subscription payload. */
function resolveProductId(data: any): string | null {
  return data?.productId ?? data?.product_id ?? data?.product?.id ?? null;
}

// ─── apply a verified Polar webhook event ────────────────────────────────────
//
// Called only from the signature-verified /polar/events HTTP handler. Keeps all
// DB writes in one transactional mutation. Unknown events / unmatchable
// businesses are ignored (return quietly) so Polar doesn't retry forever.

export const applyPolarEvent = internalMutation({
  args: {
    type: v.string(),
    data: v.any(),
  },
  returns: v.object({ handled: v.boolean() }),
  handler: async (ctx, { type, data }) => {
    const rawBusinessId = resolveBusinessId(data);
    if (!rawBusinessId) return { handled: false };

    // Validate the id actually points at an existing business before patching.
    let business;
    try {
      business = await ctx.db.get(rawBusinessId as Id<"businesses">);
    } catch {
      return { handled: false };
    }
    if (!business) return { handled: false };
    const businessId = business._id;

    switch (type) {
      case "checkout.created": {
        // Nothing to persist yet — payment not completed. Store the Polar
        // customer id if present so we can link the portal later.
        const customerId = data?.customerId ?? data?.customer_id ?? data?.customer?.id;
        if (customerId) await ctx.db.patch(businessId, { polarCustomerId: customerId });
        return { handled: true };
      }

      case "order.paid": {
        // One-time extras add message credits; subscription orders are handled
        // by the subscription.* events below (we just record the customer here).
        const productId = resolveProductId(data);
        const product = productId ? PRODUCT_BY_ID[productId] : undefined;
        const customerId = data?.customer?.id ?? data?.customerId ?? data?.customer_id;
        const patch: Record<string, unknown> = {};
        if (customerId) patch.polarCustomerId = customerId;
        if (product && product.kind === "one_time") {
          patch.extraMessageCredits =
            (business.extraMessageCredits ?? 0) + product.extraMessages;
        }
        if (Object.keys(patch).length > 0) await ctx.db.patch(businessId, patch);
        return { handled: true };
      }

      case "subscription.created":
      case "subscription.updated": {
        const status = mapSubscriptionStatus(data?.status) ?? "active";
        const productId = resolveProductId(data);
        const product = productId ? PRODUCT_BY_ID[productId] : undefined;
        const patch: Record<string, unknown> = {
          subscriptionStatus: status,
          subscriptionId: data?.id ?? business.subscriptionId,
        };
        if (productId) patch.subscriptionProductId = productId;
        if (product && product.kind === "subscription") patch.subscriptionPlan = product.plan;
        const customerId = data?.customer?.id ?? data?.customerId ?? data?.customer_id;
        if (customerId) patch.polarCustomerId = customerId;
        await ctx.db.patch(businessId, patch);
        return { handled: true };
      }

      case "subscription.canceled":
      case "subscription.revoked": {
        await ctx.db.patch(businessId, { subscriptionStatus: "cancelled" });
        return { handled: true };
      }

      default:
        return { handled: false };
    }
  },
});
