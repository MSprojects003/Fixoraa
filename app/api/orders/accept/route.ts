import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { commissionRateFor, calculateCommission, type PlanType } from '@/lib/reservation-commision';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, totalAmount } = body;

    if (!orderId || totalAmount === undefined) {
      return NextResponse.json(
        { error: 'Missing orderId or totalAmount' },
        { status: 400 }
      );
    }

    console.log('[orders/accept] Processing order:', orderId, 'Amount:', totalAmount);

    const supabase = createAdminClient();

    // Fetch order with vendor info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        vendor_id,
        user_id,
        total_amount,
        vendor:vendor_id (
          id,
          subscription_type
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('[orders/accept] Order not found:', orderError);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Get vendor subscription plan
    const planType = (order.vendor?.subscription_type ?? 'basic') as PlanType;
    const commissionAmount = calculateCommission(totalAmount, planType);
    const commissionRateDecimal = commissionRateFor(planType);
    const commissionRatePercent = Math.round(commissionRateDecimal * 100);

    // Generate PayHere hash
    const orderId_ref = `ORD_${orderId}_${Date.now()}`;
    const merchantId = process.env.NEXT_PUBLIC_PAYHERE_MERCHANT_ID || '';
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || '';

    // Create hash for PayHere
    const hashString =
      merchantId +
      orderId_ref +
      Math.ceil(commissionAmount * 100) / 100 +
      commissionAmount.toFixed(2) +
      merchantSecret;

    const crypto = await import('crypto');
    const hash = crypto
      .createHash('md5')
      .update(hashString)
      .digest('hex')
      .toUpperCase();

    console.log('[orders/accept] Commission amount:', commissionAmount, 'Rate:', commissionRatePercent);

    return NextResponse.json({
      paymentData: {
        merchant_id: merchantId,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/orders?order_id=${orderId_ref}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/orders`,
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/order-notify`,
        order_id: orderId_ref,
        items: 'Order Commission Payment',
        amount: commissionAmount.toFixed(2),
        currency: 'LKR',
        first_name: 'Order',
        last_name: 'Commission',
        email: 'orders@fixoraa.com',
        phone: '0000000000',
        address: 'Online',
        city: 'Online',
        country: 'LK',
        hash,
        custom_1: orderId,
        custom_2: planType,
      },
      orderId_ref,
      commissionAmount,
      commissionRate: commissionRatePercent,
    });
  } catch (error) {
    console.error('[orders/accept] Error:', error);
    return NextResponse.json(
      { error: 'Server error', details: String(error) },
      { status: 500 }
    );
  }
}
