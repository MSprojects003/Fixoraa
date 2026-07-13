// app/api/reservations/accept/route.ts
//
// Accepts a reservation, computes the platform's commission from the
// vendor's plan, and now ACTUALLY charges it through PayHere's Charging
// API using the customer's stored token — this is what makes it show up
// in your PayHere sandbox dashboard, unlike the pure-DB version before.
//
// REQUIRES: the customer must have already completed the one-time card
// preapproval (see /api/payment/preapproval/initiate) so a row exists in
// payment_cards for them. If they haven't, there's no PayHere transaction
// possible — we fall back to recording the commission locally only, and
// tell you that in the response so it's not a silent gap.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const COMMISSION_RATES: Record<string, number> = {
  basic: 15,
  pro: 13,
  premium: 13,
};
const DEFAULT_COMMISSION_RATE = 15;

const PAYHERE_OAUTH_URL =
  process.env.PAYHERE_ENV === 'live'
    ? 'https://www.payhere.lk/merchant/v1/oauth/token'
    : 'https://sandbox.payhere.lk/merchant/v1/oauth/token';

const PAYHERE_CHARGE_URL =
  process.env.PAYHERE_ENV === 'live'
    ? 'https://www.payhere.lk/merchant/v1/payment/charge'
    : 'https://sandbox.payhere.lk/merchant/v1/payment/charge';

async function getPayHereAccessToken(): Promise<string> {
  const appId = process.env.PAYHERE_APP_ID!;
  const appSecret = process.env.PAYHERE_APP_SECRET!;
  const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString('base64');

  const res = await fetch(PAYHERE_OAUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`PayHere OAuth failed: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function POST(request: Request) {
  try {
    console.log('[reservations/accept] route hit');

    const supabase = createAdminClient();
    const body = await request.json();
    const { id, vendorStartTime, vendorEndTime, finalVendorTotalAmount } = body;

    if (!id || !vendorStartTime || !vendorEndTime || finalVendorTotalAmount == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch the reservation.
    const { data: reservation, error: fetchError } = await supabase
      .from('service_reservations')
      .select('id, vendor_id, customer_id, payment_method, payment_reference')
      .eq('id', id)
      .single();

    if (fetchError || !reservation) {
      console.error('[reservations/accept] reservation not found:', fetchError);
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // 2. Accept the reservation.
    const { error: updateError } = await supabase
      .from('service_reservations')
      .update({
        status: 'accepted',
        vendor_start_time: vendorStartTime,
        vendor_end_time: vendorEndTime,
        final_vendor_total_amount: finalVendorTotalAmount,
        cancellation_reason: null,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[reservations/accept] update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 3. Work out the commission from the vendor's active plan.
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan_type')
      .eq('vendor_id', reservation.vendor_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const planType = subscription?.plan_type ?? null;
    const commissionRate =
      (planType && COMMISSION_RATES[planType]) ?? DEFAULT_COMMISSION_RATE;
    const commissionAmount = Number(
      (finalVendorTotalAmount * (commissionRate / 100)).toFixed(2)
    );

    // 4. Try to actually charge it through PayHere, using the customer's
    // stored token. This is the part that makes a real transaction appear
    // in your PayHere sandbox dashboard.
    let payhereChargeSucceeded = false;
    let payhereReference: string | null = null;
    let chargeWarning: string | null = null;

    const { data: card } = await supabase
      .from('payment_cards')
      .select('customer_token')
      .eq('user_id', reservation.customer_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!card) {
      chargeWarning =
        'No active payment_cards token for this customer — commission recorded locally only, nothing sent to PayHere. Customer needs to complete /api/payment/preapproval/initiate first.';
      console.warn(`[reservations/accept] ${chargeWarning}`);
    } else {
      try {
        const accessToken = await getPayHereAccessToken();
        const orderId = `COMM-RSV-${id}-${Date.now()}`;

        const chargeRes = await fetch(PAYHERE_CHARGE_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer_token: card.customer_token,
            order_id: orderId,
            items: `Commission for reservation ${id}`,
            currency: 'LKR',
            amount: commissionAmount.toFixed(2),
          }),
        });

        const chargeData = await chargeRes.json();

        if (chargeData.status === 1 && chargeData.data?.status_code === 2) {
          payhereChargeSucceeded = true;
          payhereReference = String(chargeData.data.payment_id);
          console.log(
            `[reservations/accept] PayHere charge succeeded: payment_id=${payhereReference}`
          );
        } else {
          chargeWarning = chargeData.data?.status_message || 'PayHere charge failed';
          console.error('[reservations/accept] PayHere charge failed:', chargeData);
        }
      } catch (chargeErr) {
        chargeWarning = (chargeErr as Error).message;
        console.error('[reservations/accept] PayHere charge error:', chargeErr);
      }
    }

    // 5. Record it in admin_payments either way — payhereReference is
    // null if the charge didn't happen, so you can see which rows are
    // "real" PayHere transactions vs local-only records.
    const { error: paymentError } = await supabase
      .from('admin_payments')
      .upsert(
        {
          user_id: reservation.customer_id,
          payment_amount: commissionAmount,
          payment_method: 'card',
          reciept_image_url: null,
          reference: payhereReference ?? reservation.payment_reference ?? null,
          order_id: null,
          reservation_id: id,
          payment_details: {
            commission_amount: commissionAmount,
            commission_rate: commissionRate,
            total_reservation_amount: finalVendorTotalAmount,
            vendor_id: reservation.vendor_id,
            plan_type: planType,
            payhere_charged: payhereChargeSucceeded,
            charge_warning: chargeWarning,
          },
          is_subscription_payment: false,
          is_order_payment: false,
          is_reservation_payment: true,
        },
        { onConflict: 'reservation_id' }
      );

    if (paymentError) {
      console.error('[reservations/accept] admin_payments insert error:', paymentError);
      return NextResponse.json({
        success: true,
        warning: 'Reservation accepted, but admin_payments insert failed',
        paymentErrorDetail: paymentError.message,
      });
    }

    return NextResponse.json({
      success: true,
      commissionAmount,
      commissionRate,
      payhereChargeSucceeded,
      chargeWarning,
    });
  } catch (error) {
    console.error('[reservations/accept] route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}