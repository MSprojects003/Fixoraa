// app/api/reservations/checkout/route.ts
//
// Step 2 of "Accept a reservation": after vendor stages the reservation
// (see /api/reservations/stage-acceptance), they now need to pay the
// commission via PayHere. This route:
//
// 1. Fetches the staged reservation + vendor details
// 2. Calculates the commission based on vendor's subscription plan
// 3. Builds the PayHere payment form data
// 4. Returns it so the frontend can redirect to checkout
//
// The reservation stays "pending" until PayHere confirms payment in
// /api/payment/notify/route.ts

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createReservationCommissionPaymentData } from '@/lib/payhere';
import { calculateCommission, type PlanType } from '@/lib/reservation-commision';

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { reservationId } = body;

    if (!reservationId) {
      return NextResponse.json({ error: 'Missing reservationId' }, { status: 400 });
    }

    // Fetch the reservation with vendor and customer details
    const { data: reservation, error: fetchError } = await supabase
      .from('service_reservations')
      .select(
        `id, 
         vendor_id, 
         customer_id,
         final_vendor_total_amount,
         status,
         vendor:vendors!service_reservations_vendor_id_fkey(id, user_id, subscription_type),
         customer:users!service_reservations_customer_id_fkey(
           first_name, 
           last_name, 
           email, 
           phone, 
           address, 
           city, 
           country
         )`
      )
      .eq('id', reservationId)
      .single();

    if (fetchError || !reservation) {
      console.error('[reservations/checkout] Reservation not found:', fetchError);
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Only staged reservations can proceed to checkout
    if (reservation.status !== 'pending') {
      return NextResponse.json(
        { error: `Reservation status is ${reservation.status}, expected pending` },
        { status: 400 }
      );
    }

    if (!reservation.final_vendor_total_amount) {
      return NextResponse.json(
        { error: 'Reservation not staged yet (missing final_vendor_total_amount)' },
        { status: 400 }
      );
    }

    const vendor = Array.isArray(reservation.vendor) ? reservation.vendor[0] : reservation.vendor;
    const customer = Array.isArray(reservation.customer)
      ? reservation.customer[0]
      : reservation.customer;

    if (!vendor || !customer) {
      return NextResponse.json(
        { error: 'Reservation missing vendor or customer data' },
        { status: 404 }
      );
    }

    // Calculate commission
    const planType = (vendor.subscription_type ?? 'basic') as PlanType;
    const finalAmount = Number(reservation.final_vendor_total_amount);
    const commissionAmount = calculateCommission(finalAmount, planType);

    // Build PayHere payment form data
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const paymentData = await createReservationCommissionPaymentData(
      reservationId,
      reservation.vendor_id,
      commissionAmount,
      {
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        country: customer.country || '',
      },
      `${baseUrl}/reservations/${reservationId}/accept-success`,
      `${baseUrl}/reservations/${reservationId}/accept-cancel`,
      `${process.env.PAYHERE_NOTIFY_URL || 'https://your-domain.com'}/api/payment/notify`
    );

    console.log(`[reservations/checkout] Generated payment data for reservation ${reservationId}, commission=${commissionAmount}`);

    return NextResponse.json({
      success: true,
      reservationId,
      paymentData,
      commissionAmount,
      planType,
    });
  } catch (error) {
    console.error('[reservations/checkout] route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
