import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const { vendorId, userId, planType, payhereOrderId, payherePaymentId } = await request.json();

    if (!vendorId || !userId || !planType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validPlans = ['basic', 'pro', 'premium'];
    if (!validPlans.includes(planType)) {
      return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 });
    }

    const amounts: Record<string, number> = { basic: 40.00, pro: 1500.00, premium: 3500.00 };
    const amount = amounts[planType];
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    const orderId = payhereOrderId || `BASIC-${vendorId}-${Date.now()}`;

    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        vendor_id: vendorId,
        user_id: userId,
        plan_type: planType,
        amount,
        currency: 'LKR',
        status: 'active',
        payhere_order_id: orderId,
        payhere_payment_id: payherePaymentId || null,
        billing_cycle: 'monthly',
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'payhere_order_id' });

    if (subError) {
      console.error('Subscription error:', subError);
      return NextResponse.json({ error: 'Subscription failed' }, { status: 500 });
    }

    const { error: vendorError } = await supabase
      .from('vendors')
      .update({ has_subscription: true, subscription_type: planType })
      .eq('id', vendorId);

    if (vendorError) {
      console.error('Vendor update error:', vendorError);
      return NextResponse.json({ error: 'Vendor update failed' }, { status: 500 });
    }

    const { error: paymentError } = await supabase
      .from('admin_payments')
      .upsert({
        user_id: userId,
        payment_amount: amount,
        payment_method: 'card',
        reciept_image_url: null,
        reference: payherePaymentId || null,
        order_id: orderId,
        reservation_id: null,
        payment_details: {
          plan_type: planType,
          currency: 'LKR',
          vendor_id: vendorId,
          billing_cycle: 'monthly',
        },
        is_subscription_payment: true,
        is_order_payment: false,
        is_reservation_payment: false,
      }, { onConflict: 'order_id' });

    if (paymentError) {
      console.error('admin_payments insert error:', paymentError);
    }

    return NextResponse.json({ success: true, planType });
  } catch (error) {
    console.error('Vendor subscription error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}