import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCommission, type PlanType, commissionRateFor } from '@/lib/reservation-commision';

// Test endpoint to verify the notification flow works
// Call this with: POST /api/payment/test-notify?reservation_id=YOUR_ID with paymentData in body
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const reservationId = url.searchParams.get('reservation_id');

    if (!reservationId) {
      return NextResponse.json({ error: 'Missing reservation_id query param' }, { status: 400 });
    }

    // Parse payment data from request body (from localStorage)
    let paymentData = null;
    try {
      const body = await request.json();
      paymentData = body.paymentData;
    } catch (e) {
      console.warn('[test-notify] Could not parse request body:', e);
    }

    console.log('[test-notify] Processing reservation:', reservationId);
    console.log('[test-notify] Payment data received:', paymentData);

    const supabase = createAdminClient();

    // Check reservation exists with full details
    const { data: reservation, error: fetchError } = await supabase
      .from('service_reservations')
      .select(`
        id, 
        status, 
        vendor_id, 
        customer_id, 
        final_vendor_total_amount,
        vendor:vendors!service_reservations_vendor_id_fkey(subscription_type)
      `)
      .eq('id', reservationId)
      .single();

    if (fetchError || !reservation) {
      console.error('[test-notify] Reservation not found:', fetchError);
      return NextResponse.json({ error: 'Reservation not found', details: fetchError }, { status: 404 });
    }

    console.log('[test-notify] Current reservation status:', reservation.status);

    // Update reservation with status='accepted' and total_amount from payment data
    const totalAmount = paymentData?.finalVendorTotalAmount || Number(reservation.final_vendor_total_amount || 0);
    console.log('[test-notify] Updating with total_amount:', totalAmount);

    const { data: updateResult, error: updateError } = await supabase
      .from('service_reservations')
      .update({ 
        status: 'accepted',
        total_amount: totalAmount,
      })
      .eq('id', reservationId)
      .select();

    if (updateError) {
      console.error('[test-notify] Update error:', updateError);
      return NextResponse.json({ error: 'Update failed', details: updateError }, { status: 500 });
    }

    console.log('[test-notify] Reservation updated successfully:', updateResult);

    // Insert admin_payments record with payment data
    const vendor = Array.isArray(reservation.vendor) ? reservation.vendor[0] : reservation.vendor;
    const planType = (vendor?.subscription_type ?? 'basic') as PlanType;
    const commissionAmount = paymentData?.commissionAmount || calculateCommission(totalAmount, planType);
    const commissionRate = paymentData?.commissionRate || Math.round(commissionRateFor(planType) * 100);
    const orderId = paymentData?.orderId || `RSVPAY_${reservationId}_${Date.now()}`;

    console.log('[test-notify] Creating admin_payments record:', {
      orderId,
      commissionAmount,
      commissionRate,
      totalAmount,
      vendorId: reservation.vendor_id,
      planType,
    });

    try {
      const { data: paymentResult, error: paymentError } = await supabase.from('admin_payments').insert({
        user_id: reservation.customer_id,
        payment_amount: commissionAmount,
        payment_method: 'card',
        order_id: orderId,
        reservation_id: reservationId,
        payment_details: {
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          total_reservation_amount: totalAmount,
          vendor_id: reservation.vendor_id,
          plan_type: planType,
          payment_confirmed: true,
        },
        is_subscription_payment: false,
        is_order_payment: false,
        is_reservation_payment: true,
        reference: orderId,
      }).select();

      if (paymentError) {
        console.error('[test-notify] Payment insert error:', paymentError.message, paymentError.code);
      } else {
        console.log('[test-notify] Admin payment record created:', paymentResult);
      }
    } catch (paymentErr) {
      console.error('[test-notify] Payment record exception:', paymentErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Reservation accepted and payment recorded',
      reservation: updateResult?.[0],
      payment: {
        amount: commissionAmount,
        rate: commissionRate,
        orderId,
      },
    });
  } catch (error) {
    console.error('[test-notify] Error:', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
