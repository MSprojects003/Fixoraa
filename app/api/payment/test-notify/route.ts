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

    const supabase = createAdminClient();

    // 1. Fetch reservation
    const { data: reservation, error: fetchError } = await supabase
      .from('service_reservations')
      .select('id, status, vendor_id, customer_id, final_vendor_total_amount')
      .eq('id', reservationId)
      .single();

    if (fetchError || !reservation) {
      console.error('[test-notify] Reservation not found:', fetchError);
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    console.log('[test-notify] Found reservation:', reservationId);

    // 2. Fetch vendor subscription plan
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('subscription_type')
      .eq('id', reservation.vendor_id)
      .single();

    if (vendorError || !vendor) {
      console.error('[test-notify] Vendor not found:', vendorError);
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const planType = (vendor.subscription_type ?? 'basic') as PlanType;
    const totalAmount = Number(reservation.final_vendor_total_amount || 0);
    const commissionAmount = calculateCommission(totalAmount, planType);
    const commissionRateDecimal = commissionRateFor(planType);
    const commissionRatePercent = Math.round(commissionRateDecimal * 100);

    console.log('[test-notify] Calculated:', { planType, totalAmount, commissionAmount, commissionRatePercent });

    // 3. Update reservation status and total_amount
    const { error: updateError } = await supabase
      .from('service_reservations')
      .update({
        status: 'accepted',
        total_amount: totalAmount,
      })
      .eq('id', reservationId);

    if (updateError) {
      console.error('[test-notify] Update error:', updateError);
      return NextResponse.json({ error: 'Update failed', details: updateError.message }, { status: 500 });
    }

    console.log('[test-notify] Reservation updated to accepted');

    // 4. Insert into admin_payments table
    try {
      const { data: paymentResult, error: paymentError } = await supabase
        .from('admin_payments')
        .insert({
          user_id: reservation.customer_id,
          payment_amount: commissionAmount,
          payment_method: 'card',
          order_id: `RSVPAY_${reservationId}_${Date.now()}`,
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
          reference: null,
        })
        .select();

      if (paymentError) {
        console.error('[test-notify] Payment insert error:', paymentError.message, paymentError.code);
        // Don't fail the entire request if payment insert fails - reservation is already updated
        return NextResponse.json({
          success: true,
          message: 'Reservation accepted but payment record creation failed',
          warning: paymentError.message,
          data: { reservationId, totalAmount },
        });
      }

      console.log('[test-notify] Payment record created:', paymentResult?.[0]?.id);

      return NextResponse.json({
        success: true,
        message: 'Reservation accepted and payment recorded',
        data: {
          reservationId,
          totalAmount,
          commissionAmount,
          commissionRate: commissionRatePercent,
        },
      });
    } catch (paymentErr) {
      console.error('[test-notify] Payment exception:', paymentErr);
      return NextResponse.json({
        success: true,
        message: 'Reservation accepted',
        warning: 'Payment record creation encountered an error',
        data: { reservationId, totalAmount },
      });
    }
  } catch (error) {
    console.error('[test-notify] Server error:', error);
    return NextResponse.json({ 
      error: 'Server error',
      details: String(error),
    }, { status: 500 });
  }
}
