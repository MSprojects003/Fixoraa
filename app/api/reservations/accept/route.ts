import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { id, vendorStartTime, vendorEndTime, finalVendorTotalAmount } = body;

    console.log('[reservations/accept] Received:', { id, vendorStartTime, vendorEndTime, finalVendorTotalAmount });

    if (!id) {
      return NextResponse.json({ error: 'Missing reservation ID' }, { status: 400 });
    }

    // Fetch reservation
    const { data: reservation, error: fetchError } = await supabase
      .from('service_reservations')
      .select('id, vendor_id, customer_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !reservation) {
      console.error('[reservations/accept] Not found:', fetchError);
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Update reservation
    const { error: updateError } = await supabase
      .from('service_reservations')
      .update({
        status: 'accepted',
        vendor_start_time: vendorStartTime,
        vendor_end_time: vendorEndTime,
        final_vendor_total_amount: finalVendorTotalAmount,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[reservations/accept] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    console.log('[reservations/accept] Success');
    return NextResponse.json({ success: true, message: 'Reservation accepted' });
  } catch (error) {
    console.error('[reservations/accept] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
