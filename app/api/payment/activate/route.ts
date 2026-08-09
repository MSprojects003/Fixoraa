// app/api/payment/activate/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const PLAN_AMOUNTS: Record<string, number> = {
  basic: 0.10,
  pro: 1500.00,
  premium: 3500.00,
};

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const {
      vendorId,
      userId,
      planType,
      payhereOrderId,
      payherePaymentId,
      currency = 'LKR',
    } = body;

    if (!vendorId || !userId || !planType || !payhereOrderId) {
      return NextResponse.json(
        { error: 'Missing required fields: vendorId, userId, planType, payhereOrderId' },
        { status: 400 }
      );
    }

    if (!['basic', 'pro', 'premium'].includes(planType)) {
      return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 });
    }

    const { data: vendor, error: vendorFetchError } = await supabase
      .from('vendors')
      .select('id')
      .eq('id', vendorId)
      .eq('user_id', userId)
      .single();

    if (vendorFetchError || !vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const amount = PLAN_AMOUNTS[planType];
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert(
        {
          vendor_id: vendorId,
          user_id: userId,
          plan_type: planType,
          amount,
          currency,
          status: 'active',
          payhere_order_id: payhereOrderId,
          payhere_payment_id: payherePaymentId || null,
          billing_cycle: 'monthly',
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'payhere_order_id' }
      );

    if (subError) {
      console.error('Subscription insert error:', subError);
      return NextResponse.json(
        { error: 'Failed to insert subscription', detail: subError.message },
        { status: 500 }
      );
    }

    const { error: vendorUpdateError } = await supabase
      .from('vendors')
      .update({ has_subscription: true, subscription_type: planType })
      .eq('id', vendorId);

    if (vendorUpdateError) {
      console.error('Vendor update error:', vendorUpdateError);
      return NextResponse.json(
        { error: 'Subscription saved but vendor update failed', detail: vendorUpdateError.message },
        { status: 500 }
      );
    }

    const { error: paymentError } = await supabase
      .from('admin_payments')
      .upsert(
        {
          user_id: userId,
          payment_amount: amount,
          payment_method: 'card',
          reciept_image_url: null,
          reference: payherePaymentId || null,
          order_id: payhereOrderId,
          reservation_id: null,
          payment_details: {
            plan_type: planType,
            currency,
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
      console.error('admin_payments insert error:', paymentError);
    }

    console.log(`Subscription activated: vendor=${vendorId} plan=${planType}`);

    return NextResponse.json({
      success: true,
      planType,
      vendorId,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Activate route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}