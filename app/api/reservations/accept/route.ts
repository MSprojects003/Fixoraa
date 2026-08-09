import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCommission, type PlanType, commissionRateFor } from '@/lib/reservation-commision';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { id, vendorStartTime, vendorEndTime, finalVendorTotalAmount } = body;

    console.log('[reservations/accept] Request:', { id });

    if (!id || finalVendorTotalAmount == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch reservation
    const { data: reservation, error: fetchError } = await supabase
      .from('service_reservations')
      .select(`
        id,
        vendor_id,
        customer_id,
        status,
        vendor:vendors!service_reservations_vendor_id_fkey(subscription_type, address),
        customer:users!service_reservations_customer_id_fkey(first_name, last_name, email, phone)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !reservation) {
      console.error('[reservations/accept] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // 2. Update reservation
    console.log('[reservations/accept] Updating reservation with:', {
      id,
      vendorStartTime,
      vendorEndTime,
      finalVendorTotalAmount,
    });

    const { data: updateResult, error: updateError } = await supabase
      .from('service_reservations')
      .update({
        vendor_start_time: vendorStartTime,
        vendor_end_time: vendorEndTime,
        final_vendor_total_amount: finalVendorTotalAmount,
      })
      .eq('id', id)
      .select();

    if (updateError) {
      console.error('[reservations/accept] Update error:', updateError);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    console.log('[reservations/accept] Updated reservation:', updateResult);

    // 3. Calculate commission
    const vendor = Array.isArray(reservation.vendor) ? reservation.vendor[0] : reservation.vendor;
    const customer = Array.isArray(reservation.customer) ? reservation.customer[0] : reservation.customer;
    const planType = (vendor?.subscription_type ?? 'basic') as PlanType;
    const amount = Number(finalVendorTotalAmount);
    const commissionAmount = calculateCommission(amount, planType);
    const commissionRateDecimal = commissionRateFor(planType);
    const commissionRatePercent = Math.round(commissionRateDecimal * 100);

    // 4. Generate PayHere hash
    const orderId = `RSVPAY_${id}_${Date.now()}`;
    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const secret = process.env.PAYHERE_MERCHANT_SECRET;
    const currency = 'LKR';
    const formattedAmount = commissionAmount.toFixed(2);

    if (!merchantId || !secret) {
      console.error('[reservations/accept] PayHere config missing');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const hashedSecret = crypto.createHash('md5').update(secret).digest('hex').toUpperCase();
    const hashInput = `${merchantId}${orderId}${formattedAmount}${currency}${hashedSecret}`;
    const hash = crypto.createHash('md5').update(hashInput).digest('hex').toUpperCase();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // 5. Create admin_payments record
    try {
      const { error: paymentError } = await supabase.from('admin_payments').insert({
        user_id: reservation.customer_id,
        payment_amount: commissionAmount,
        payment_method: 'card',
        order_id: orderId,
        reservation_id: id,
        payment_details: {
          commission_rate: commissionRatePercent,
          total_reservation_amount: amount,
          vendor_id: reservation.vendor_id,
          plan_type: planType,
        },
        is_subscription_payment: false,
        is_order_payment: false,
        is_reservation_payment: true,
      });

      if (paymentError) {
        console.warn('[reservations/accept] Payment record warning:', paymentError.message);
      } else {
        console.log('[reservations/accept] Payment record created successfully for order:', orderId);
      }
    } catch (paymentErr) {
      console.error('[reservations/accept] Payment record error:', paymentErr);
    }

    // 6. Return PayHere form data
    const paymentData = {
      merchant_id: merchantId,
      return_url: `${appUrl}/reservations`,
      cancel_url: `${appUrl}/reservations`,
      notify_url: `${appUrl}/api/payment/notify`,
      order_id: orderId,
      items: `Reservation commission - ${id.slice(0, 8).toUpperCase()}`,
      amount: formattedAmount,
      currency,
      first_name: customer?.first_name || '',
      last_name: customer?.last_name || '',
      email: customer?.email || '',
      phone: customer?.phone || '',
      address: vendor?.address || '',
      city: 'Colombo',
      country: 'Sri Lanka',
      custom_1: reservation.vendor_id,
      custom_2: id,
      hash,
    };

    console.log('[reservations/accept] Success - order:', orderId);

    return NextResponse.json({
      success: true,
      reservationId: id,
      orderId,
      commissionAmount,
      commissionRate: commissionRatePercent,
      paymentData,
    });
  } catch (error) {
    console.error('[reservations/accept] Exception:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
