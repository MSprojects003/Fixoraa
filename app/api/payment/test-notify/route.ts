import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCommission, type PlanType, commissionRateFor } from '@/lib/reservation-commision';

// Test endpoint to verify the notification flow works
// Call this with: POST /api/payment/test-notify?reservation_id=YOUR_ID
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const reservationId = url.searchParams.get('reservation_id');

    if (!reservationId) {
      return NextResponse.json({ error: 'Missing reservation_id query param' }, { status: 400 });
    }

    console.log('[test-notify] Attempting to update reservation:', reservationId);

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

    // Update status
    const { data: updateResult, error: updateError } = await supabase
      .from('service_reservations')
      .update({ status: 'accepted' })
      .eq('id', reservationId)
      .select();

    if (updateError) {
      console.error('[test-notify] Update error:', updateError);
      return NextResponse.json({ error: 'Update failed', details: updateError }, { status: 500 });
    }

    console.log('[test-notify] Update successful:', updateResult);

    // Create admin_payments record if it doesn't exist
    const vendor = Array.isArray(reservation.vendor) ? reservation.vendor[0] : reservation.vendor;
    const planType = (vendor?.subscription_type ?? 'basic') as PlanType;
    const amount = Number(reservation.final_vendor_total_amount || 0);
    const commissionAmount = calculateCommission(amount, planType);
    const commissionRateDecimal = commissionRateFor(planType);
    const commissionRatePercent = Math.round(commissionRateDecimal * 100);

    const orderId = `RSVPAY_${reservationId}_${Date.now()}`;

    const { error: paymentError } = await supabase.from('admin_payments').insert({
      user_id: reservation.customer_id,
      payment_amount: commissionAmount,
      payment_method: 'card',
      order_id: orderId,
      reservation_id: reservationId,
      payment_details: {
        commission_rate: commissionRatePercent,
        total_reservation_amount: amount,
        vendor_id: reservation.vendor_id,
        plan_type: planType,
        payment_confirmed: true,
      },
      is_subscription_payment: false,
      is_order_payment: false,
      is_reservation_payment: true,
      reference: 'payhere_commission',
    }).catch(err => {
      console.warn('[test-notify] Could not create payment record:', err);
      return { error: null }; // Don't fail if payment record already exists
    });

    if (paymentError && !paymentError.message?.includes('duplicate')) {
      console.warn('[test-notify] Payment record warning:', paymentError);
    }

    return NextResponse.json({
      success: true,
      message: 'Reservation updated to accepted',
      reservation: updateResult?.[0],
      commission: {
        amount: commissionAmount,
        rate: commissionRatePercent,
      },
    });
  } catch (error) {
    console.error('[test-notify] Error:', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
