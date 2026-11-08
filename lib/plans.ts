export type Plan = "starter" | "pro" | "agency";

export const STARTER_CLIP_LIMIT = 3;

export function normalizePlan(value: unknown): Plan {
  return value === "pro" || value === "agency" ? value : "starter";
}
