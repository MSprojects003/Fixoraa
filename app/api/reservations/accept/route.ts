// app/api/reservations/accept/route.ts
//
// Accepts a reservation and stages it for PayHere commission payment.
// When the vendor accepts a reservation, we:
// 1. Update the reservation status to "accepted"
// 2. Calculate the commission based on their subscription plan
// 3. Return payment data so the frontend can redirect to PayHere
// 4. PayHere notifies /api/payment/notify when payment completes
//
// The reservation becomes fully "accepted" only after PayHere payment succeeds
// (confirmed via webhook in /api/payment/notify).

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    console.log('[reservations/accept] route hit');

    const supabase = createAdminClient();
    const body = await request.json();
    const { id, vendorStartTime, vendorEndTime, finalVendorTotalAmount } = body;

    if (!id || !vendorStartTime || !vendorEndTime || finalVendorTotalAmount == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch the reservation
    const { data: reservation, error: fetchError } = await supabase
      .from('service_reservations')
      .select('id, vendor_id, customer_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !reservation) {
      console.error('[reservations/accept] reservation not found:', fetchError);
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // 2. Update reservation with vendor's times and amount
    const { error: updateError } = await supabase
      .from('service_reservations')
      .update({
        vendor_start_time: vendorStartTime,
        vendor_end_time: vendorEndTime,
        final_vendor_total_amount: finalVendorTotalAmount,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[reservations/accept] update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`[reservations/accept] Reservation ${id} updated successfully`);

    return NextResponse.json({
      success: true,
      message: 'Reservation accepted and ready for payment'
    });
  } catch (error) {
    console.error('[reservations/accept] route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
