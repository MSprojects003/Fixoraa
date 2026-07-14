import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCommission, type PlanType, commissionRateFor } from '@/lib/reservation-commision';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('order_id');

    if (!orderId) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    console.log('[order-payment-notify] Processing order payment for:', orderId);

    // Get payment data from localStorage stored in URL params
    let paymentData = null;
    try {
      const body = await request.json();
      paymentData = body.paymentData;
    } catch (e) {
      console.warn('[order-payment-notify] Could not parse body');
    }

    const supabase = createAdminClient();

    // Fetch order with items
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        total_amount,
        user_id,
        vendor_id,
        order_items(id, status, total_amount),
        vendor:vendors!orders_vendor_id_fkey(subscription_type)
      `)
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      console.error('[order-payment-notify] Order not found:', fetchError);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    console.log('[order-payment-notify] Order fetched:', order);

    // Calculate new total (sum of non-cancelled items)
    const acceptableItems = order.order_items?.filter((item: any) => item.status !== 'cancelled') || [];
    const newTotal = acceptableItems.reduce((sum: number, item: any) => sum + parseFloat(item.total_amount || 0), 0);

    console.log('[order-payment-notify] New total after cancellations:', newTotal);

    // Update order status and total amount
    const { data: updateResult, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'accepted',
        total_amount: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select();

    if (updateError) {
      console.error('[order-payment-notify] Order update error:', updateError);
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    console.log('[order-payment-notify] Order updated:', updateResult);

    // Update all acceptable items to 'accepted' status
    if (acceptableItems.length > 0) {
      const { error: itemError } = await supabase
        .from('order_items')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .in(
          'id',
          acceptableItems.map((item: any) => item.id)
        );

      if (itemError) {
        console.warn('[order-payment-notify] Item update warning:', itemError);
      } else {
        console.log('[order-payment-notify] Order items updated to accepted');
      }
    }

    // Create payment record in admin_payments
    const vendor = order.vendor;
    const planType = (vendor?.subscription_type ?? 'basic') as PlanType;
    const commissionAmount = newTotal * commissionRateFor(planType);
    const commissionRatePercent = Math.round(commissionRateFor(planType) * 100);

    const paymentOrderId = `ORDER_${orderId}_${Date.now()}`;

    try {
      const { error: paymentError } = await supabase.from('admin_payments').upsert({
        user_id: order.user_id,
        payment_amount: commissionAmount,
        payment_method: 'card',
        order_id: paymentOrderId,
        reservation_id: null,
        order_item_id: orderId,
        payment_details: {
          commission_rate: commissionRatePercent,
          commission_amount: commissionAmount,
          total_order_amount: newTotal,
          vendor_id: order.vendor_id,
          plan_type: planType,
          payment_confirmed: true,
        },
        is_subscription_payment: false,
        is_order_payment: true,
        is_reservation_payment: false,
        reference: paymentOrderId,
      }, { onConflict: 'order_id' });

      if (paymentError) {
        console.warn('[order-payment-notify] Payment record warning:', paymentError.message);
      } else {
        console.log('[order-payment-notify] Payment record created successfully');
      }
    } catch (paymentErr) {
      console.error('[order-payment-notify] Payment record error:', paymentErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Order accepted and payment recorded',
      data: {
        orderId,
        newTotal,
        commissionAmount,
        commissionRate: commissionRatePercent,
      },
    });
  } catch (error) {
    console.error('[order-payment-notify] Error:', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
