// lib/reservation-commission.ts
//
// Single source of truth for "what % does the platform take from a
// reservation, based on the vendor's subscription plan". Used by:
//  - app/api/reservations/stage-acceptance/route.ts (computes the
//    amount to charge before redirecting to PayHere)
//  - app/api/payment/notify/route.ts (records what was actually charged)

export type PlanType = "basic" | "pro" | "premium";

export const COMMISSION_RATES: Record<PlanType, number> = {
  basic: 0.15, // 15%
  pro: 0.13, // 13%
  premium: 0.13, // 13%
};

export function commissionRateFor(planType: string | null | undefined): number {
  return COMMISSION_RATES[(planType as PlanType) ?? "basic"] ?? COMMISSION_RATES.basic;
}

/** Rounds to 2 decimal places — PayHere amounts must be exact cents. */
export function calculateCommission(
  finalAmount: number,
  planType: string | null | undefined
): number {
  const rate = commissionRateFor(planType);
  return Math.round(finalAmount * rate * 100) / 100;
}