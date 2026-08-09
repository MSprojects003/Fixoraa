// app/api/payment/notify-order/route.ts
//
// Dedicated PayHere webhook for ORDER commission payments — kept
// separate from app/api/payment/notify/route.ts so that file stays
// untouched.
//
// REWRITTEN: this is now the ONLY place that writes order_items.status,
// orders.track_id, orders.status, and vendors.order_credit_tracking.
// The accept route no longer touches any of these — it only stages a
// row here for this webhook to read back once status_code === '2'.
//
// PayHere calls this server-to-server; same trust model as the
// existing notify route. Needs a public URL (use ngrok locally).
// Set this order's notify_url to:
//   https://<your-domain>/api/payment/notify-order

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { consumeOrderCredit } from '@/lib/order-limits';
import crypto from 'crypto';

function md5Upper(input: string) {
  return crypto.createHash('md5').update(input).digest('hex').toUpperCase();
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const form = await request.formData();
    const data: Record<string, string> = {};
    form.forEach((value, key) => (data[key] = String(value)));

    console.log('[notify-order] Payload received:', data);

    const {
      merchant_id,
      order_id, // PayHere's pseudo id, e.g. ORDPAY_<uuid>_<ts>
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      payment_id,
      custom_1: vendorId,
      custom_2: orderId, // our real orders.id
    } = data;

    const secret = process.env.PAYHERE_MERCHANT_SECRET;
    if (!secret) {
      console.error('[notify-order] PAYHERE_MERCHANT_SECRET not set');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const localSig = md5Upper(
      merchant_id + order_id + payhere_amount + payhere_currency + status_code + md5Upper(secret)
    );

    if (localSig !== md5sig) {
      console.error('[notify-order] Signature mismatch. Local:', localSig, 'Received:', md5sig);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    if (!order_id.startsWith('ORDPAY_')) {
      console.warn('[notify-order] Ignoring non-order payment:', order_id);
      return NextResponse.json({ received: true, ignored: true });
    }

    // Always ack non-success statuses without writing anything — the
    // order simply stays "pending" (same as reservations).
    if (status_code !== '2') {
      console.warn('[notify-order] Payment not successful:', { order_id, status_code });
      return NextResponse.json({ received: true, status: status_code });
    }

    // Pull back the staged admin_payments row for its tracking_id.
    const { data: stagedPayment, error: stagedFetchError } = await supabase
      .from('admin_payments')
      .select('id, payment_details')
      .eq('order_id', order_id)
      .single();

    if (stagedFetchError || !stagedPayment) {
      console.error('[notify-order] Staged payment not found:', { order_id, stagedFetchError });
      return NextResponse.json({ error: 'Staged payment not found' }, { status: 404 });
    }

    const stagedDetails = (stagedPayment.payment_details ?? {}) as Record<string, unknown>;
    const trackingId = typeof stagedDetails.tracking_id === 'string' ? stagedDetails.tracking_id : null;

    // Idempotency guard — if a duplicate/retried webhook comes in
    // after we've already confirmed this order, don't double-confirm
    // items or double-consume a credit.
    const { data: orderRow, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, user_id, vendor_id')
      .eq('id', orderId)
      .single();

    if (fetchError || !orderRow) {
      console.error('[notify-order] Order not found:', { orderId, fetchError });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (orderRow.status !== 'pending') {
      console.log('[notify-order] Order already processed, skipping:', orderId);
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    // 1. Confirm every order_item that isn't already cancelled.
    const { error: itemsUpdateError } = await supabase
      .from('order_items')
      .update({ status: 'confirmed' })
      .eq('order_id', orderId)
      .neq('status', 'cancelled');

    if (itemsUpdateError) {
      console.error('[notify-order] Item update error:', itemsUpdateError);
      return NextResponse.json({ error: 'Failed to update order items' }, { status: 500 });
    }

    // 2. Stamp tracking id + flip order to confirmed. This is the
    // real "accepted" moment — only reachable once payment cleared.
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        status: 'confirmed',
        ...(trackingId ? { track_id: trackingId } : {}),
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      console.error('[notify-order] Failed to confirm order:', orderUpdateError);
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    // 3. Consume one order-accept credit for the vendor. Only happens
    // here, only on confirmed payment — cancellations never reach
    // this code path.
    const { data: vendorRow, error: vendorFetchError } = await supabase
      .from('vendors')
      .select('order_credit_tracking')
      .eq('id', orderRow.vendor_id)
      .single();

    if (!vendorFetchError && vendorRow) {
      const nextTracking = consumeOrderCredit(vendorRow.order_credit_tracking);
      const { error: creditUpdateError } = await supabase
        .from('vendors')
        .update({ order_credit_tracking: nextTracking })
        .eq('id', orderRow.vendor_id);

      if (creditUpdateError) {
        console.error('[notify-order] Credit update error:', creditUpdateError);
      }
    } else {
      console.error('[notify-order] Vendor fetch for credit consumption failed:', vendorFetchError);
    }

    // 4. Finalize the admin_payments row (unstage it).
    const { error: paymentError } = await supabase
      .from('admin_payments')
      .update({
        reference: payment_id ?? null,
        payment_details: { ...stagedDetails, staged: false },
      })
      .eq('id', stagedPayment.id);

    if (paymentError) {
      console.error('[notify-order] admin_payments finalize error:', paymentError);
    }

    console.log('[notify-order] Order confirmed:', orderId);
    return NextResponse.json({ received: true, success: true });
  } catch (error) {
    console.error('[notify-order] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}