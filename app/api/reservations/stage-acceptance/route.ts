// app/api/reservations/stage-acceptance/route.ts
//
// Step 1 of "Accept a reservation": the vendor picks a start/end time
// and a final total amount. We save those immediately, but the
// reservation STAYS "pending" — it only becomes "accepted" once the
// PayHere commission payment actually clears (see
// app/api/payment/notify/route.ts). That's the whole reason this is
// a separate step instead of one direct update.
//
// Runs with the service-role client so it can read the vendor's
// subscription_type reliably (needed to compute the commission rate)
// regardless of the caller's RLS policies.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateCommission, type PlanType } from "@/lib/reservation-commision";

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { id, vendorStartTime, vendorEndTime, finalVendorTotalAmount } = body;

    if (!id || !vendorStartTime || !vendorEndTime || finalVendorTotalAmount == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const amount = Number(finalVendorTotalAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid final total amount" }, { status: 400 });
    }

    const { data: reservation, error: fetchError } = await supabase
      .from("service_reservations")
      .select(
        `id, vendor_id, status,
         vendor:vendors!service_reservations_vendor_id_fkey ( id, user_id, subscription_type )`
      )
      .eq("id", id)
      .single();

    if (fetchError || !reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (reservation.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending reservations can be accepted" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("service_reservations")
      .update({
        vendor_start_time: vendorStartTime,
        vendor_end_time: vendorEndTime,
        final_vendor_total_amount: amount,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const vendor = Array.isArray(reservation.vendor) ? reservation.vendor[0] : reservation.vendor;
    const planType = (vendor?.subscription_type ?? "basic") as PlanType;
    const commission = calculateCommission(amount, planType);

    return NextResponse.json({
      success: true,
      vendorId: reservation.vendor_id,
      planType,
      commission,
    });
  } catch (error) {
    console.error("Stage acceptance error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}