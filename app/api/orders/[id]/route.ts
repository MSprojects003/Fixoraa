import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        user:users!orders_user_id_fkey(id, first_name, last_name, email, phone),
        order_items(
          id,
          product_id,
          quantity,
          unit_price,
          total_amount,
          status,
          cancellation_reason,
          product:products!order_items_product_id_fkey(id, name, image_url, price)
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('[orders/[id] API] Error:', error);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[orders/[id] API] Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status, payment_reference, shipping_address, track_id } = body;

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('orders')
      .update({
        ...(status && { status }),
        ...(payment_reference && { payment_reference }),
        ...(shipping_address && { shipping_address }),
        ...(track_id && { track_id }),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('[orders/[id] PATCH] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[orders/[id] PATCH] Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('[orders/[id] DELETE] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[orders/[id] DELETE] Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
