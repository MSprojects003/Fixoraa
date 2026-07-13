// app/api/payment/notify/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';
import { commissionRateFor, type PlanType } from '@/lib/reservation-commision';

const PLAN_AMOUNTS: Record<string, number> = {
  basic: 0.10,
  pro: 1500.00,
  premium: 3500.00,
};

function md5Upper(input: string) {
  return crypto.createHash('md5').update(input).digest('hex').toUpperCase();
}

// PayHere's server calls this directly — not the customer's browser — so
// it's the only place you can trust a payment actually succeeded without
// it being fakeable. Needs a public URL (won't reach localhost — use
// ngrok for local testing). Set notify_url to:
//   https://<your-domain>/api/payment/notify
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const form = await request.formData();
    const data: Record<string, string> = {};
    form.forEach((value, key) => (data[key] = String(value)));

    const {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
    } = data;

    const secret = process.env.PAYHERE_MERCHANT_SECRET;
    if (!secret) {
      console.error('PAYHERE_MERCHANT_SECRET not set');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const localSig = md5Upper(
      merchant_id + order_id + payhere_amount + payhere_currency + status_code + md5Upper(secret)
    );

    if (localSig !== md5sig) {
      console.error('PayHere notify: signature mismatch', data);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Two kinds of payment share this one webhook — tell them apart by
    // the order_id prefix set when the payment was created:
    //   SUB-...      -> lib/payhere.ts createPayHerePaymentData()
    //   RSVPAY_...   -> lib/payhere.ts createReservationCommissionPaymentData()
    if (order_id.startsWith('RSVPAY_')) {
      return handleReservationCommissionNotify(supabase, data);
    }

    return handleSubscriptionNotify(supabase, data);
  } catch (error) {
    console.error('Notify route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------- Subscription payments ----------

async function handleSubscriptionNotify(
  supabase: ReturnType<typeof createAdminClient>,
  data: Record<string, string>
) {
  const {
    order_id,
    payhere_amount,
    payhere_currency,
    status_code,
    payment_id,
    custom_1: vendorId,
    custom_2: userId,
  } = data;

  // status_code: 2 = success, 0 = pending, -1 = cancelled, -2 = failed, -3 = chargedback
  if (status_code !== '2') {
    return NextResponse.json({ received: true, status: status_code });
  }

  const planType = order_id.split('-')[1] ?? 'basic';
  const amount = PLAN_AMOUNTS[planType] ?? parseFloat(payhere_amount);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const { error: subError } = await supabase.from('subscriptions').upsert(
    {
      vendor_id: vendorId,
      user_id: userId,
      plan_type: planType,
      amount,
      currency: payhere_currency,
      status: 'active',
      payhere_order_id: order_id,
      payhere_payment_id: payment_id,
      billing_cycle: 'monthly',
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: 'payhere_order_id' }
  );

  if (subError) {
    console.error('Subscription upsert error:', subError);
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  await supabase
    .from('vendors')
    .update({ has_subscription: true, subscription_type: planType })
    .eq('id', vendorId);

  const { error: paymentError } = await supabase.from('admin_payments').upsert(
    {
      user_id: userId,
      payment_amount: amount,
      payment_method: 'card',
      reciept_image_url: null,
      reference: payment_id ?? null,
      order_id,
      reservation_id: null,
      payment_details: {
        plan_type: planType,
        currency: payhere_currency,
        vendor_id: vendorId,
        billing_cycle: 'monthly',
      },
      is_subscription_payment: true,
      is_order_payment: false,
      is_reservation_payment: false,
    },
    { onConflict: 'order_id' }
  );

  if (paymentError) {
    console.error('admin_payments insert error (subscription):', paymentError);
  }

  return NextResponse.json({ received: true });
}

// ---------- Reservation commission payments ----------

async function handleReservationCommissionNotify(
  supabase: ReturnType<typeof createAdminClient>,
  data: Record<string, string>
) {
  const {
    order_id,
    payhere_amount,
    status_code,
    payment_id,
    custom_1: vendorId,
    custom_2: reservationId,
  } = data;

  if (status_code !== '2') {
    // Payment failed/was cancelled at PayHere — leave the reservation
    // as "pending" (its schedule/amount are already staged, so the
    // vendor can just retry Accept without re-entering anything).
    console.log('Reservation commission payment not successful:', { order_id, status_code });
    return NextResponse.json({ received: true, status: status_code });
  }

  const { data: vendor } = await supabase
    .from('vendors')
    .select('user_id, subscription_type')
    .eq('id', vendorId)
    .single();

  console.log('[notify] Updating reservation to accepted:', {
    reservationId,
    vendorId,
    paymentId: payment_id,
    amount: payhere_amount,
  });

  const { error: reservationError } = await supabase
    .from('service_reservations')
    .update({ status: 'accepted' })
    .eq('id', reservationId);

  if (reservationError) {
    console.error('[notify] Failed to mark reservation accepted after payment:', reservationError);
  } else {
    console.log('[notify] Successfully updated reservation to accepted:', reservationId);
  }

  const planType = (vendor?.subscription_type ?? 'basic') as PlanType;
  const commissionRateDecimal = commissionRateFor(planType);
  const commissionRatePercent = Math.round(commissionRateDecimal * 100);

  const { error: paymentError } = await supabase.from('admin_payments').upsert(
    {
      user_id: vendor?.user_id,
      payment_amount: parseFloat(payhere_amount),
      payment_method: 'card',
      reciept_image_url: null,
      reference: payment_id ?? null,
      order_id,
      reservation_id: reservationId,
      payment_details: {
        plan_type: planType,
        commission_rate: commissionRatePercent,
      },
      is_subscription_payment: false,
      is_order_payment: false,
      is_reservation_payment: true,
    },
    { onConflict: 'order_id' }
  );

  if (paymentError) {
    console.error('admin_payments insert error (reservation commission):', paymentError);
  }

  return NextResponse.json({ received: true });
}
