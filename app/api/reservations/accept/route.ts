import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCommission, type PlanType, commissionRateFor } from '@/lib/reservation-commision';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { id, vendorStartTime, vendorEndTime, finalVendorTotalAmount } = body;

    console.log('[reservations/accept] Received:', { id, vendorStartTime, vendorEndTime, finalVendorTotalAmount });

    if (!id || !vendorStartTime || !vendorEndTime || finalVendorTotalAmount == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch reservation with customer and vendor
    const { data: reservation, error: fetchError } = await supabase
      .from('service_reservations')
      .select(`
        id, vendor_id, customer_id, status,
        vendor:vendors!service_reservations_vendor_id_fkey(subscription_type, address),
        customer:users!service_reservations_customer_id_fkey(first_name, last_name, email, phone)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !reservation) {
      console.error('[reservations/accept] Not found:', fetchError);
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (reservation.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending reservations can be accepted' }, { status: 400 });
    }

    // 2. Update reservation with times and amount
    const { error: updateError } = await supabase
      .from('service_reservations')
      .update({
        vendor_start_time: vendorStartTime,
        vendor_end_time: vendorEndTime,
        final_vendor_total_amount: finalVendorTotalAmount,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[reservations/accept] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 });
    }

    // 3. Calculate commission
    const vendor = Array.isArray(reservation.vendor) ? reservation.vendor[0] : reservation.vendor;
    const customer = Array.isArray(reservation.customer) ? reservation.customer[0] : reservation.customer;
    
    const planType = (vendor?.subscription_type ?? 'basic') as PlanType;
    const amount = Number(finalVendorTotalAmount);
    const commissionAmount = calculateCommission(amount, planType);
    const commissionRateDecimal = commissionRateFor(planType);
    const commissionRatePercent = Math.round(commissionRateDecimal * 100);

    console.log(`[reservations/accept] Commission calculated: ${commissionAmount} (${commissionRatePercent}% of ${amount})`);

    // 4. Generate PayHere payment data with hash
    const orderId = `RSVPAY_${id}_${Date.now()}`;
    const merchantId = process.env.NEXT_PUBLIC_PAYHERE_MERCHANT_ID || process.env.PAYHERE_MERCHANT_ID;
    const secret = process.env.PAYHERE_MERCHANT_SECRET;
    const currency = 'LKR';
    const formattedAmount = commissionAmount.toFixed(2);

    if (!merchantId) {
      console.error('[reservations/accept] PAYHERE_MERCHANT_ID not set');
      return NextResponse.json({ error: 'PAYHERE_MERCHANT_ID missing' }, { status: 500 });
    }

    if (!secret) {
      console.error('[reservations/accept] PAYHERE_MERCHANT_SECRET not set');
      return NextResponse.json({ error: 'PAYHERE_MERCHANT_SECRET missing' }, { status: 500 });
    }

    // Generate hash directly (same logic as /api/payment/hash)
    const hashedSecret = crypto.createHash('md5').update(secret).digest('hex').toUpperCase();
    const hashInput = `${merchantId}${orderId}${formattedAmount}${currency}${hashedSecret}`;
    const hash = crypto.createHash('md5').update(hashInput).digest('hex').toUpperCase();

    console.log('[reservations/accept] Hash generated for order:', orderId);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // 5. Record admin_payment (payment will be linked when webhook confirms)
    const { error: paymentError } = await supabase
      .from('admin_payments')
      .insert({
        user_id: reservation.customer_id,
        payment_amount: commissionAmount,
        payment_method: 'card',
        reciept_image_url: null,
        reference: null,
        order_id: orderId,
        reservation_id: id,
        payment_details: {
          commission_rate: commissionRatePercent,
          total_reservation_amount: amount,
          vendor_id: reservation.vendor_id,
          plan_type: planType,
          staged: true,
        },
        is_subscription_payment: false,
        is_order_payment: false,
        is_reservation_payment: true,
      });

    if (paymentError && !paymentError.message.includes('duplicate')) {
      console.warn('[reservations/accept] Could not create admin_payment:', paymentError);
    }

    // 6. Return PayHere form data for frontend to submit
    // Note: address and city come from vendor table, country is always Sri Lanka
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

    console.log(`[reservations/accept] Payment prepared, order: ${orderId}, amount: ${formattedAmount}`);
    console.log('[reservations/accept] PayHere data:', {
      merchant_id: paymentData.merchant_id,
      order_id: paymentData.order_id,
      amount: paymentData.amount,
      currency: paymentData.currency,
      hash: paymentData.hash?.slice(0, 10) + '...',
      first_name: paymentData.first_name,
      email: paymentData.email,
    });

    return NextResponse.json({
      success: true,
      reservationId: id,
      orderId,
      commissionAmount,
      commissionRate: commissionRatePercent,
      paymentData,
    });
  } catch (error) {
    console.error('[reservations/accept] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
