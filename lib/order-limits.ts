// lib/order-limits.ts
//
// Per-vendor order-ACCEPT credit limits, gated by subscription plan.
// Mirrors the vendors.edit_tracking jsonb pattern already in use.
//
// Shape stored in vendors.order_credit_tracking:
//   { used: number, period_start: string | null }
//
// Limits:
//   basic   -> 4 accepted orders per rolling period
//   pro     -> 20
//   premium -> unlimited (null)
//
// Only a CONFIRMED payment consumes a credit (see notify-order route).
// Cancelling items/orders is free and never touches this counter —
// checkOrderCredit() is read-only and safe to call as many times as
// you like (e.g. before redirecting to PayHere).
//
// NOTE: this uses a 30-day rolling window anchored to period_start,
// not subscriptions.expires_at. If billing should reset on the fixed
// subscription cycle instead, swap isPeriodExpired()'s comparison —
// it's isolated here on purpose so it's a one-place change.

import type { PlanType } from "./reservation-commision";

export const ORDER_CREDIT_LIMITS: Record<PlanType, number | null> = {
  basic: 4,
  pro: 20,
  premium: null, // unlimited
};

const ROLLING_WINDOW_DAYS = 30;

export interface OrderCreditTracking {
  used: number;
  period_start: string | null;
}

export function parseOrderCreditTracking(raw: unknown): OrderCreditTracking {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return {
      used: typeof obj.used === "number" ? obj.used : 0,
      period_start: typeof obj.period_start === "string" ? obj.period_start : null,
    };
  }
  return { used: 0, period_start: null };
}

function isPeriodExpired(periodStart: string | null): boolean {
  if (!periodStart) return true;
  const start = new Date(periodStart).getTime();
  const windowMs = ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - start > windowMs;
}

// Effective tracking state "right now" — resets used/period_start if
// the rolling window has lapsed. Callers persist this back only when
// they're actually consuming a credit (see consumeOrderCredit).
export function effectiveTracking(raw: unknown): OrderCreditTracking {
  const tracking = parseOrderCreditTracking(raw);
  if (isPeriodExpired(tracking.period_start) && tracking.used > 0) {
    return { used: 0, period_start: null };
  }
  return tracking;
}

export interface CreditCheckResult {
  allowed: boolean;
  used: number;
  limit: number | null; // null = unlimited
  remaining: number | null; // null = unlimited
}

// Read-only. Safe to call from the accept route before staging a
// payment, so a vendor never pays commission only to discover
// afterwards that they had no credits left.
export function checkOrderCredit(planType: PlanType, rawTracking: unknown): CreditCheckResult {
  const limit = ORDER_CREDIT_LIMITS[planType];
  const tracking = effectiveTracking(rawTracking);

  if (limit === null) {
    return { allowed: true, used: tracking.used, limit: null, remaining: null };
  }

  const remaining = Math.max(limit - tracking.used, 0);
  return { allowed: tracking.used < limit, used: tracking.used, limit, remaining };
}

// Called ONLY from notify-order, ONLY once PayHere confirms payment.
// Never called from the accept route, and never for cancellations.
export function consumeOrderCredit(rawTracking: unknown): OrderCreditTracking {
  const tracking = effectiveTracking(rawTracking);
  return {
    used: tracking.used + 1,
    period_start: tracking.period_start ?? new Date().toISOString(),
  };
}