import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const body = await request.json();
    const { status, cancellation_reason } = body;

    const supabase = createAdminClient();

    // Update order item
    const { data: itemResult, error: itemError } = await supabase
      .from('order_items')
      .update({
        status,
        cancellation_reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.itemId)
      .eq('order_id', params.id)
      .select();

    if (itemError) {
      console.error('[orders/items API] Item update error:', itemError);
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    console.log('[orders/items API] Item updated successfully:', itemResult);

    return NextResponse.json({
      success: true,
      message: 'Order item updated',
      data: itemResult?.[0],
    });
  } catch (error) {
    console.error('[orders/items API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
