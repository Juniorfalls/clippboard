export type PaystackPlan = "pro" | "agency";

export const PAYSTACK_CURRENCY = "USD";

export const PAYSTACK_PLAN_AMOUNTS: Record<PaystackPlan, number> = {
  pro: 1900,
  agency: 4900,
};

export function isPaystackPlan(value: unknown): value is PaystackPlan {
  return value === "pro" || value === "agency";
}
