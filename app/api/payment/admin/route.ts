// app/api/payment/admin/route.ts
//
// GET /api/payment/admin
// GET /api/payment/admin?type=subscription | order | reservation
//
// NOTE: no auth check yet — anyone who calls this can read every payment.
// Add an admin-role check (verify session + role = 'admin') before shipping.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'subscription' | 'order' | 'reservation' | null

    let query = supabase
      .from('admin_payments')
      .select(
        `
        id, user_id, created_at, payment_amount, payment_method,
        reciept_image_url, payment_details, reference, order_id,
        reservation_id, is_subscription_payment, is_order_payment,
        is_reservation_payment,
        user:users!admin_payments_user_id_fkey ( id, first_name, last_name, email )
      `
      )
      .order('created_at', { ascending: false });

    if (type === 'subscription') query = query.eq('is_subscription_payment', true);
    if (type === 'order') query = query.eq('is_order_payment', true);
    if (type === 'reservation') query = query.eq('is_reservation_payment', true);

    const { data, error } = await query;

    if (error) {
      console.error('Fetch admin_payments error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ payments: data ?? [] });
  } catch (error) {
    console.error('Payment admin route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}