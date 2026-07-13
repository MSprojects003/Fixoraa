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
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { calculateCommission, type PlanType } from '@/lib/reservation-commision';

const COMMISSION_RATES: Record<string, number> = {
  basic: 15,
  pro: 13,
  premium: 13,
};
const DEFAULT_COMMISSION_RATE = 15;

export async function POST(request: Request) {
  try {
    console.log('[reservations/accept] route hit');

    // Check authentication
    const cookieStore = await cookies();
    const supabaseServer = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseServer.auth.getUser();
    if (!user || userError) {
      console.error('[reservations/accept] user not authenticated:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const body = await request.json();
    const { id, vendorStartTime, vendorEndTime, finalVendorTotalAmount } = body;

    if (!id || !vendorStartTime || !vendorEndTime || finalVendorTotalAmount == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch the reservation with customer and vendor info
    const { data: reservation, error: fetchError } = await supabase
      .from('service_reservations')
      .select(`
        id, 
        vendor_id, 
        customer_id,
        status,
        vendor:vendors!service_reservations_vendor_id_fkey(id, user_id, subscription_type),
        customer:users!service_reservations_customer_id_fkey(first_name, last_name, email, phone, address, city, country)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !reservation) {
      console.error('[reservations/accept] reservation not found:', fetchError);
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (reservation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending reservations can be accepted' },
        { status: 400 }
      );
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

    // 3. Calculate commission based on vendor's subscription plan
    const vendor = Array.isArray(reservation.vendor) ? reservation.vendor[0] : reservation.vendor;
    const customer = Array.isArray(reservation.customer) ? reservation.customer[0] : reservation.customer;
    
    const planType = (vendor?.subscription_type ?? 'basic') as PlanType;
    const commissionAmount = calculateCommission(Number(finalVendorTotalAmount), planType);
    const commissionRate = COMMISSION_RATES[planType] ?? DEFAULT_COMMISSION_RATE;

    console.log(`[reservations/accept] Reservation ${id}: commission=${commissionAmount}, plan=${planType}`);

    // 4. Record the staged payment in admin_payments with pending status
    const orderId = `RSVPAY_${id}_${Date.now()}`;
    
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
          commission_amount: commissionAmount,
          commission_rate: commissionRate,
          total_reservation_amount: Number(finalVendorTotalAmount),
          vendor_id: reservation.vendor_id,
          plan_type: planType,
          staged: true,
        },
        is_subscription_payment: false,
        is_order_payment: false,
        is_reservation_payment: true,
      });

    if (paymentError && !paymentError.message.includes('duplicate')) {
      console.error('[reservations/accept] admin_payments insert error:', paymentError);
    }

    // 5. Return payment staging info so frontend can redirect to PayHere
    return NextResponse.json({
      success: true,
      reservationId: id,
      orderId,
      commissionAmount,
      commissionRate: `${commissionRate}%`,
      totalAmount: Number(finalVendorTotalAmount),
      customer: {
        first_name: customer?.first_name || '',
        last_name: customer?.last_name || '',
        email: customer?.email || '',
        phone: customer?.phone || '',
        address: customer?.address || '',
        city: customer?.city || '',
        country: customer?.country || '',
      },
      vendor: {
        id: vendor?.id,
        user_id: vendor?.user_id,
      },
      ready_for_payhere: true,
    });
  } catch (error) {
    console.error('[reservations/accept] route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
