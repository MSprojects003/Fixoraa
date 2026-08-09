// app/api/payment/test-notify-order/route.ts
//
// Client-callable fallback for confirming an order after PayHere redirects
// the browser back to return_url. This does the SAME writes that
// app/api/payment/notify-order/route.ts does (order_items -> confirmed,
// orders -> confirmed + track_id, consume vendor order credit, unstage the
// admin_payments row) but is triggered directly from the client instead of
// PayHere's server-to-server webhook.
//
// Why this exists: notify_url only works if PayHere's servers can reach
// your server (a public URL). In local dev — and in any environment where
// that webhook can't land — order_items.status and orders.status never
// move off "pending" because nothing else ever confirms them. This route
// closes that gap the same way app/api/payment/test-notify/route.ts
// already does for reservations.
//
// NOTE: like the reservations test-notify route, this performs no
// signature verification, since it isn't being called by PayHere — it's
// called by our own client after the redirect back. Don't expose this
// without also fixing/verifying notify_url in production if you want the
// server-to-server path to be the source of truth there instead.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { consumeOrderCredit } from '@/lib/order-limits';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('order_id');

    if (!orderId) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: orderRow, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, user_id, vendor_id')
      .eq('id', orderId)
      .single();

    if (fetchError || !orderRow) {
      console.error('[test-notify-order] Order not found:', { orderId, fetchError });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Idempotency guard — matches notify-order's behavior.
    if (orderRow.status !== 'pending') {
      console.log('[test-notify-order] Order already processed:', orderId);
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    // Pull back the staged admin_payments row (created in
    // app/api/orders/accept/route.ts) so we can read tracking_id and
    // unstage it once we're done. Staged rows are matched by their
    // payment_details.orders_id, since the accept route stores our real
    // order id there (order_id on admin_payments is PayHere's pseudo id).
    const { data: stagedPayments, error: stagedFetchError } = await supabase
      .from('admin_payments')
      .select('id, payment_details')
      .eq('is_order_payment', true)
      .contains('payment_details', { orders_id: orderId })
      .order('created_at', { ascending: false })
      .limit(1);

    if (stagedFetchError) {
      console.error('[test-notify-order] Staged payment lookup error:', stagedFetchError);
    }

    const stagedPayment = stagedPayments?.[0];
    const stagedDetails = (stagedPayment?.payment_details ?? {}) as Record<string, unknown>;
    const trackingId = typeof stagedDetails.tracking_id === 'string' ? stagedDetails.tracking_id : null;

    // 1. Confirm every order_item that isn't already cancelled.
    const { error: itemsUpdateError } = await supabase
      .from('order_items')
      .update({ status: 'confirmed' })
      .eq('order_id', orderId)
      .neq('status', 'cancelled');

    if (itemsUpdateError) {
      console.error('[test-notify-order] Item update error:', itemsUpdateError);
      return NextResponse.json({ error: 'Failed to update order items' }, { status: 500 });
    }

    // 2. Stamp tracking id + flip order to confirmed.
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        status: 'confirmed',
        ...(trackingId ? { track_id: trackingId } : {}),
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      console.error('[test-notify-order] Failed to confirm order:', orderUpdateError);
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    // 3. Consume one order-accept credit for the vendor — only here, only
    // on confirmed payment, exactly like notify-order does.
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
        console.error('[test-notify-order] Credit update error:', creditUpdateError);
      }
    } else {
      console.error('[test-notify-order] Vendor fetch for credit consumption failed:', vendorFetchError);
    }

    // 4. Finalize the staged admin_payments row, if we found one.
    if (stagedPayment) {
      const { error: paymentError } = await supabase
        .from('admin_payments')
        .update({
          payment_details: { ...stagedDetails, staged: false },
        })
        .eq('id', stagedPayment.id);

      if (paymentError) {
        console.error('[test-notify-order] admin_payments finalize error:', paymentError);
      }
    } else {
      console.warn('[test-notify-order] No staged admin_payments row found for order:', orderId);
    }

    console.log('[test-notify-order] Order confirmed:', orderId);
    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    console.error('[test-notify-order] error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}