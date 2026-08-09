import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCommission, type PlanType, commissionRateFor } from '@/lib/reservation-commision';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const reservationId = url.searchParams.get('reservation_id');

    if (!reservationId) {
      console.error('[test-notify] Missing reservation_id');
      return NextResponse.json({ error: 'Missing reservation_id' }, { status: 400 });
    }

    console.log('[test-notify] Processing reservation:', reservationId);
    const supabase = createAdminClient();

    // 1. Fetch reservation with vendor info
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
      console.error('[test-notify] Reservation not found:', fetchError?.message);
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    console.log('[test-notify] Reservation found, vendor_id:', reservation.vendor_id);

    // 2. Get vendor subscription plan
    const vendor = Array.isArray(reservation.vendor) ? reservation.vendor[0] : reservation.vendor;
    const planType = (vendor?.subscription_type ?? 'basic') as PlanType;
    const totalAmount = Number(reservation.final_vendor_total_amount || 0);
    const commissionAmount = calculateCommission(totalAmount, planType);
    const commissionRateDecimal = commissionRateFor(planType);
    const commissionRatePercent = Math.round(commissionRateDecimal * 100);

    console.log('[test-notify] Commission:', {
      planType,
      totalAmount,
      commissionAmount,
      commissionRatePercent,
      customerId: reservation.customer_id,
      vendorId: reservation.vendor_id,
    });

    // 3. Update reservation status and total_amount
    const { error: updateError, data: updateResult } = await supabase
      .from('service_reservations')
      .update({
        status: 'accepted',
        total_amount: totalAmount,
      })
      .eq('id', reservationId)
      .select();

    if (updateError) {
      console.error('[test-notify] Reservation update failed:', updateError.message);
      return NextResponse.json({ error: 'Reservation update failed' }, { status: 500 });
    }

    console.log('[test-notify] Reservation updated successfully');

    // 4. Insert payment record into admin_payments using upsert (handles duplicate reservation_id)
    console.log('[test-notify] Inserting admin_payments record...');
    
    const orderId = `RSVPAY_${reservationId}_${Date.now()}`;
    const paymentRecord = {
      user_id: reservation.customer_id,
      payment_amount: commissionAmount,
      payment_method: 'card',
      order_id: orderId,
      reservation_id: reservationId,
      payment_details: {
        plan_type: planType,
        vendor_id: reservation.vendor_id,
        commission_rate: commissionRatePercent,
        commission_amount: commissionAmount,
        total_reservation_amount: totalAmount,
      },
      is_subscription_payment: false,
      is_order_payment: false,
      is_reservation_payment: true,
      reference: 'payhere_commission',
      reciept_image_url: null,
    };

    console.log('[test-notify] Payment record to upsert:', JSON.stringify(paymentRecord, null, 2));

    // Use upsert to handle UNIQUE constraint on reservation_id
    const { data: paymentResult, error: paymentError } = await supabase
      .from('admin_payments')
      .upsert(paymentRecord, { onConflict: 'reservation_id' })
      .select();

    if (paymentError) {
      console.error('[test-notify] Payment upsert failed:', paymentError.message);
      console.error('[test-notify] Error code:', paymentError.code);
      console.error('[test-notify] Full error details:', paymentError);
      
      // Return error response so client knows payment insert failed
      return NextResponse.json({
        success: false,
        message: 'Reservation accepted but payment record failed',
        error: paymentError.message,
        data: { reservationId, totalAmount },
      }, { status: 500 });
    }

    console.log('[test-notify] Payment record upserted successfully:', paymentResult?.[0]?.id);

    return NextResponse.json({
      success: true,
      message: 'Reservation accepted and payment recorded',
      data: {
        reservationId,
        totalAmount,
        commissionAmount,
        commissionRate: commissionRatePercent,
        paymentId: paymentResult?.[0]?.id,
      },
    });
  } catch (error) {
    console.error('[test-notify] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Server error',
      details: String(error),
    }, { status: 500 });
  }
}
