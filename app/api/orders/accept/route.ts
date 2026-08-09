// app/api/orders/accept/route.ts
//
// REWRITTEN: this route now performs ZERO writes to order_items.status
// or orders.track_id / orders.status. That was the bug — it used to
// confirm items and stamp track_id immediately, before payment ever
// happened, so by the time PayHere's webhook fired there was nothing
// left for it to meaningfully update.
//
// New flow:
//   1. Validate the order is pending.
//   2. Read-only credit check (vendors.order_credit_tracking) — block
//      here if the vendor is out of credits, BEFORE they pay anything.
//   3. Compute commission from the order's current total_amount (already
//      reduced by any prior item cancellations via /api/orders/items/cancel).
//   4. Stage an admin_payments row with staged: true — the tracking ID
//      typed in the dialog is stashed inside payment_details.tracking_id
//      so notify-order can read it back once payment actually clears.
//   5. Return PayHere checkout data.
//
// order_items.status, orders.track_id, orders.status, and the vendor's
// credit counter are ALL written exclusively by
// app/api/payment/notify-order/route.ts, gated on status_code === '2'.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCommission, type PlanType, commissionRateFor } from '@/lib/reservation-commision';
import { checkOrderCredit } from '@/lib/order-limits';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { id, trackingId } = body;

    console.log('[orders/accept] Request:', { id });

    if (!id || !trackingId?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch order + vendor (incl. credit tracking) + customer.
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id, vendor_id, user_id, status, total_amount,
        vendor:vendors!orders_vendor_id_fkey(subscription_type, address, order_credit_tracking),
        customer:users!orders_user_id_fkey(first_name, last_name, email, phone)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      console.error('[orders/accept] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending orders can be accepted' }, { status: 400 });
    }

    const amount = Number(order.total_amount);
    if (!(amount > 0)) {
      return NextResponse.json(
        { error: 'This order has no payable amount (all items cancelled or total is 0)' },
        { status: 400 }
      );
    }

    const vendor = Array.isArray(order.vendor) ? order.vendor[0] : order.vendor;
    const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
    const planType = (vendor?.subscription_type ?? 'basic') as PlanType;

    // 2. Read-only credit check — block BEFORE any payment happens.
    const credit = checkOrderCredit(planType, vendor?.order_credit_tracking);
    if (!credit.allowed) {
      return NextResponse.json(
        {
          error: `Order limit reached for the ${planType} plan (${credit.used}/${credit.limit}). Upgrade your plan to accept more orders.`,
          creditExhausted: true,
          plan: planType,
          used: credit.used,
          limit: credit.limit,
        },
        { status: 403 }
      );
    }

    // 3. Commission, computed on the order's current (possibly
    // already-reduced) total_amount.
    const commissionAmount = calculateCommission(amount, planType);
    const commissionRateDecimal = commissionRateFor(planType);
    const commissionRatePercent = Math.round(commissionRateDecimal * 100);

    // 4. PayHere hash. "ORDPAY_" prefix keeps these visually
    // distinguishable from reservations' "RSVPAY_" even though both
    // now go through separate notify routes.
    const orderId = `ORDPAY_${id}_${Date.now()}`;
    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const secret = process.env.PAYHERE_MERCHANT_SECRET;
    const currency = 'LKR';
    const formattedAmount = commissionAmount.toFixed(2);

    if (!merchantId || !secret) {
      console.error('[orders/accept] PayHere config missing');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const hashedSecret = crypto.createHash('md5').update(secret).digest('hex').toUpperCase();
    const hashInput = `${merchantId}${orderId}${formattedAmount}${currency}${hashedSecret}`;
    const hash = crypto.createHash('md5').update(hashInput).digest('hex').toUpperCase();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // 5. Stage an admin_payments row. NOTHING in orders / order_items
    // is touched yet — trackingId travels inside payment_details so
    // notify-order can pick it up only once payment is confirmed.
    const { error: paymentError } = await supabase.from('admin_payments').insert({
      user_id: order.user_id,
      payment_amount: commissionAmount,
      payment_method: 'card',
      order_id: orderId,
      reservation_id: null,
      payment_details: {
        orders_id: id,
        tracking_id: trackingId.trim(),
        commission_rate: commissionRatePercent,
        total_order_amount: amount,
        vendor_id: order.vendor_id,
        plan_type: planType,
        staged: true,
      },
      is_subscription_payment: false,
      is_order_payment: true,
      is_reservation_payment: false,
    });

    if (paymentError) {
      console.error('[orders/accept] Payment stage error:', paymentError);
      return NextResponse.json({ error: 'Failed to stage payment' }, { status: 500 });
    }

    // 6. Return PayHere form data.
    const paymentData = {
      merchant_id: merchantId,
      return_url: `${appUrl}/orders`,
      cancel_url: `${appUrl}/orders`,
      notify_url: `${appUrl}/api/payment/notify-order`,
      order_id: orderId,
      items: `Order commission - ${id.slice(0, 8).toUpperCase()}`,
      amount: formattedAmount,
      currency,
      first_name: customer?.first_name || '',
      last_name: customer?.last_name || '',
      email: customer?.email || '',
      phone: customer?.phone || '',
      address: vendor?.address || '',
      city: 'Colombo',
      country: 'Sri Lanka',
      custom_1: order.vendor_id,
      custom_2: id,
      hash,
    };

    console.log('[orders/accept] Staged, awaiting payment:', orderId);

    return NextResponse.json({
      success: true,
      orderId: id,
      payhereOrderId: orderId,
      commissionAmount,
      commissionRate: commissionRatePercent,
      creditsRemaining: credit.remaining,
      paymentData,
    });
  } catch (error) {
    console.error('[orders/accept] Exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}