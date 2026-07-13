import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

    // Check reservation exists
    const { data: reservation, error: fetchError } = await supabase
      .from('service_reservations')
      .select('id, status')
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

    return NextResponse.json({
      success: true,
      message: 'Reservation updated to accepted',
      reservation: updateResult?.[0],
    });
  } catch (error) {
    console.error('[test-notify] Error:', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
