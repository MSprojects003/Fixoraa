import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const userId = searchParams.get('user_id');

    const supabase = createAdminClient();
    const offset = (page - 1) * limit;

    let query = supabase
      .from('orders')
      .select(`
        *,
        user:users!orders_user_id_fkey(id, first_name, last_name, email),
        order_items(
          id,
          product_id,
          quantity,
          unit_price,
          total_amount,
          product:products!order_items_product_id_fkey(id, name, image_url)
        )
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[orders API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('[orders API] Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      user_id,
      vendor_id,
      total_amount,
      payment_method,
      payment_reference,
      shipping_address,
      order_items,
    } = body;

    if (!user_id || !total_amount || !payment_method || !order_items?.length) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Create order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id,
        vendor_id,
        total_amount,
        payment_method,
        payment_reference,
        shipping_address,
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('[orders API] Order creation error:', orderError);
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // Create order items
    const itemsToInsert = order_items.map((item: any) => ({
      order_id: orderData.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_amount: item.total_amount,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('[orders API] Order items creation error:', itemsError);
      // Rollback order creation
      await supabase.from('orders').delete().eq('id', orderData.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, data: orderData },
      { status: 201 }
    );
  } catch (error) {
    console.error('[orders API] Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
