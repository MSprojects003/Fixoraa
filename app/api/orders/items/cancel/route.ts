// app/api/orders/items/cancel/route.ts
//
// Cancels a single order_item and re-derives the parent order's
// total_amount from scratch (sums every remaining non-cancelled item
// fresh, rather than subtracting in place — can't drift on retry).
//
// UPDATED: if this cancellation was the last non-cancelled item, the
// parent order itself flips to "cancelled" too — there's nothing left
// on it to accept. This never consumes an order-accept credit;
// cancelling is always free.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { orderItemId, reason } = body;

    if (!orderItemId || !reason?.trim()) {
      return NextResponse.json({ error: "Missing orderItemId or reason" }, { status: 400 });
    }

    const { data: item, error: fetchError } = await supabase
      .from("order_items")
      .select("id, order_id, status")
      .eq("id", orderItemId)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: "Order item not found" }, { status: 404 });
    }

    if (item.status === "cancelled") {
      return NextResponse.json({ error: "Item is already cancelled" }, { status: 400 });
    }

    const { data: parentOrder, error: parentFetchError } = await supabase
      .from("orders")
      .select("status")
      .eq("id", item.order_id)
      .single();

    if (parentFetchError || !parentOrder) {
      return NextResponse.json({ error: "Parent order not found" }, { status: 404 });
    }

    if (parentOrder.status !== "pending") {
      return NextResponse.json(
        { error: "Items can only be cancelled while the order is pending" },
        { status: 400 }
      );
    }

    const { error: itemUpdateError } = await supabase
      .from("order_items")
      .update({ status: "cancelled", cancellation_reason: reason.trim() })
      .eq("id", orderItemId);

    if (itemUpdateError) {
      console.error("[orders/items/cancel] Item update error:", itemUpdateError);
      return NextResponse.json({ error: "Failed to cancel item" }, { status: 500 });
    }

    // Recompute the parent order's total from every remaining
    // non-cancelled item, and check whether ANY items are left.
    const { data: siblingItems, error: siblingsError } = await supabase
      .from("order_items")
      .select("total_amount, status")
      .eq("order_id", item.order_id);

    if (siblingsError) {
      console.error("[orders/items/cancel] Fetch siblings error:", siblingsError);
      return NextResponse.json({ error: "Failed to recompute order total" }, { status: 500 });
    }

    const remaining = siblingItems.filter((it) => it.status !== "cancelled");
    const newTotal = remaining.reduce((sum, it) => sum + Number(it.total_amount), 0);
    const allCancelled = remaining.length === 0;

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        total_amount: newTotal,
        ...(allCancelled ? { status: "cancelled" } : {}),
      })
      .eq("id", item.order_id);

    if (orderUpdateError) {
      console.error("[orders/items/cancel] Order update error:", orderUpdateError);
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      newTotalAmount: newTotal,
      orderCancelled: allCancelled,
    });
  } catch (error) {
    console.error("[orders/items/cancel] Exception:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}