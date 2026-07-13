import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCommission, type PlanType, commissionRateFor } from '@/lib/reservation-commision';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const reservationId = url.searchParams.get('reservation_id');

    if (!reservationId) {
      return NextResponse.json({ error: 'Missing reservation_id' }, { status: 400 });
    }

    // Parse payment data from request body
    let paymentData = null;
    try {
      const body = await request.json();
      paymentData = body.paymentData;
    } catch (e) {
      console.warn('[test-notify] Could not parse body');
    }

    console.log('[test-notify] Reservation ID:', reservationId);
    console.log('[test-notify] Payment data:', paymentData);

    const supabase = createAdminClient();

    // 1. Fetch reservation with vendor details
    const { data: reservation, error: fetchError } = await supabase
      .from('service_reservations')
      .select(`
        id,
        status,
        vendor_id,
        customer_id,
        final_vendor_total_amount,
        vendor:vendors!service_reservations_vendor_id_fkey(subscription_type, user_id)
      `)
      .eq('id', reservationId)
      .single();

    if (fetchError || !reservation) {
      console.error('[test-notify] Reservation not found');
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Get vendor and subscription plan
    const vendor = Array.isArray(reservation.vendor) ? reservation.vendor[0] : reservation.vendor;
    const planType = (vendor?.subscription_type ?? 'basic') as PlanType;
    
    // Calculate total amount and commission
    const totalAmount = paymentData?.finalVendorTotalAmount || Number(reservation.final_vendor_total_amount || 0);
    const commissionAmount = calculateCommission(totalAmount, planType);
    const commissionRateDecimal = commissionRateFor(planType);
    const commissionRatePercent = Math.round(commissionRateDecimal * 100);

    console.log('[test-notify] Plan type:', planType);
    console.log('[test-notify] Total amount:', totalAmount);
    console.log('[test-notify] Commission amount:', commissionAmount);
    console.log('[test-notify] Commission rate:', commissionRatePercent);

    // 2. Update reservation status to accepted and set total_amount
    const { error: updateError } = await supabase
      .from('service_reservations')
      .update({
        status: 'accepted',
        total_amount: totalAmount,
      })
      .eq('id', reservationId);

    if (updateError) {
      console.error('[test-notify] Failed to update reservation:', updateError);
      return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 });
    }

    console.log('[test-notify] Reservation updated to accepted with total_amount:', totalAmount);

    // 3. Insert admin_payments record
    const orderId = paymentData?.orderId || `RSVPAY_${reservationId}_${Date.now()}`;
    
    const { data: insertResult, error: insertError } = await supabase
      .from('admin_payments')
      .insert({
        user_id: reservation.customer_id,
        payment_amount: commissionAmount,
        payment_method: 'card',
        order_id: orderId,
        reservation_id: reservationId,
        payment_details: {
          commission_rate: commissionRatePercent,
          commission_amount: commissionAmount,
          total_reservation_amount: totalAmount,
          vendor_id: reservation.vendor_id,
          plan_type: planType,
        },
        is_subscription_payment: false,
        is_order_payment: false,
        is_reservation_payment: true,
        reference: orderId,
        reciept_image_url: null,
      })
      .select();

    if (insertError) {
      console.error('[test-notify] Failed to insert payment:', insertError.message, insertError.code);
      return NextResponse.json({ 
        error: 'Failed to insert payment',
        details: insertError.message,
      }, { status: 500 });
    }

    console.log('[test-notify] Payment record inserted successfully:', insertResult);

    return NextResponse.json({
      success: true,
      message: 'Reservation accepted and payment recorded',
      data: {
        reservationId,
        totalAmount,
        commissionAmount,
        commissionRate: commissionRatePercent,
        paymentInserted: true,
      },
    });
  } catch (error) {
    console.error('[test-notify] Server error:', error);
    return NextResponse.json({ 
      error: 'Server error',
      details: String(error),
    }, { status: 500 });
  }
}
