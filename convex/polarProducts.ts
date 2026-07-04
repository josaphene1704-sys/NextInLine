/**
 * Polar product catalog — maps our internal plan keys to the exact Polar
 * Product IDs. Product IDs are not secrets (they appear in checkout URLs), so
 * keeping them in code is fine; the access token / webhook secret live in
 * Convex environment variables instead.
 *
 * Organization: next-in-line
 */

export type PolarProductKey =
  | "basic"
  | "premium"
  | "extraBasic"
  | "extraPremium";

type SubscriptionProduct = {
  id: string;
  kind: "subscription";
  plan: "basic" | "premium";
  priceIls: number;
};
type OneTimeProduct = {
  id: string;
  kind: "one_time";
  extraMessages: number;
  priceIls: number;
};

export const POLAR_PRODUCTS: Record<PolarProductKey, SubscriptionProduct | OneTimeProduct> = {
  basic: {
    id: "dc594078-6e5e-45a7-ae03-b4a355d5dec0",
    kind: "subscription",
    plan: "basic",
    priceIls: 99,
  },
  premium: {
    id: "b3ffc176-f6d7-4b23-a183-256b14add4ff",
    kind: "subscription",
    plan: "premium",
    priceIls: 149,
  },
  extraBasic: {
    id: "cca34d1d-d02e-4691-ba01-24087697fa7e",
    kind: "one_time",
    extraMessages: 50,
    priceIls: 30,
  },
  extraPremium: {
    id: "fa7bb491-9eea-450b-b7d5-92a89edd15a7",
    kind: "one_time",
    extraMessages: 100,
    priceIls: 50,
  },
};

/** Reverse lookup: Polar product id → product definition (for webhook handling). */
export const PRODUCT_BY_ID: Record<string, SubscriptionProduct | OneTimeProduct> =
  Object.fromEntries(Object.values(POLAR_PRODUCTS).map((p) => [p.id, p]));
