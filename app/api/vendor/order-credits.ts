// app/api/vendor/order-credits/route.ts
//
// GET /api/vendor/order-credits?vendorId=<uuid>
//
// Read-only: returns the vendor's current plan + remaining order-accept
// credits, for the "Pro | 9 credits available" badge in the header.
//
// NOTE: no auth check yet — same caveat as app/api/payment/admin/route.ts.
// Add a session/ownership check before shipping (verify the caller
// actually owns this vendorId).

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkOrderCredit } from '@/lib/order-limits';
import type { PlanType } from '@/lib/reservation-commision';

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');

    if (!vendorId) {
      return NextResponse.json({ error: 'Missing vendorId' }, { status: 400 });
    }

    const { data: vendor, error } = await supabase
      .from('vendors')
      .select('subscription_type, order_credit_tracking')
      .eq('id', vendorId)
      .single();

    if (error || !vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const planType = (vendor.subscription_type ?? 'basic') as PlanType;
    const credit = checkOrderCredit(planType, vendor.order_credit_tracking);

    return NextResponse.json({
      plan: planType,
      used: credit.used,
      limit: credit.limit, // null = unlimited
      remaining: credit.remaining, // null = unlimited
    });
  } catch (error) {
    console.error('[vendor/order-credits] Exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}