'use client';

import React, { useState } from 'react';
import { useOrder, useUpdateOrder } from '@/lib/hooks/use-orders';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  accepted: 'bg-green-100 text-green-800',
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  accepted: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

interface OrderDetailsSheetProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailsSheet({
  orderId,
  open,
  onOpenChange,
}: OrderDetailsSheetProps) {
  const { data: order, isLoading, isError, error, refetch } = useOrder(orderId);
  const updateMutation = useUpdateOrder(orderId);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingItemId, setCancellingItemId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);

  console.log('[OrderDetailsSheet] Loading order:', orderId, 'Loading:', isLoading, 'Error:', isError, 'Data:', order);

  if (isError) {
    console.error('[OrderDetailsSheet] Error fetching order:', error, 'Order ID:', orderId);
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full max-w-2xl">
          <SheetHeader>
            <SheetTitle>Error Loading Order</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-6">
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Failed to load order</p>
                <p className="text-sm text-red-700 mt-1">
                  {error?.message || 'The order could not be found or accessed'}
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                console.log('[OrderDetailsSheet] Retrying order fetch for:', orderId);
                refetch();
              }}
              className="w-full"
            >
              Retry
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="w-full"
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!order && !isLoading) {
    console.warn('[OrderDetailsSheet] No order data and not loading');
    return null;
  }

  // Calculate total excluding cancelled items
  const acceptableItems = order?.order_items?.filter(
    (item) => item.status !== 'cancelled'
  ) || [];
  const cancelledItems = order?.order_items?.filter(
    (item) => item.status === 'cancelled'
  ) || [];

  const originalTotal = parseFloat(order?.total_amount?.toString() || '0');
  const cancelledAmount = cancelledItems.reduce(
    (sum, item) => sum + parseFloat(item.total_amount?.toString() || '0'),
    0
  );
  const currentTotal = originalTotal - cancelledAmount;

  const handleCancelItem = async () => {
    if (!cancellingItemId || !cancellationReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }

    try {
      const response = await fetch(
        `/api/orders/${orderId}/items/${cancellingItemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'cancelled',
            cancellation_reason: cancellationReason,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to cancel item');
      }

      toast.success('Item cancelled successfully');
      setCancellationDialogOpen(false);
      setCancellingItemId(null);
      setCancellationReason('');
      refetch();
    } catch (error) {
      console.error('Error cancelling item:', error);
      toast.error('Failed to cancel item');
    }
  };

  const handleAcceptOrder = async () => {
    try {
      // Store payment data in localStorage
      const paymentPayload = {
        orderId,
        totalAmount: currentTotal,
        itemsCount: acceptableItems.length,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('payhere_pending_order_payment', JSON.stringify(paymentPayload));

      // Generate PayHere form
      const response = await fetch('/api/orders/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          totalAmount: currentTotal,
        }),
      });

      const data = await response.json();

      if (data.paymentData) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = 'https://sandbox.payhere.lk/pay/checkout';
        form.target = '_blank';
        if (process.env.NEXT_PUBLIC_PAYHERE_ENV === 'live') {
          form.action = 'https://www.payhere.lk/pay/checkout';
        }
        form.style.display = 'none';

        Object.entries(data.paymentData).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      toast.error('Failed to process payment');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Order Details</SheetTitle>
          <SheetDescription>
            {order && `Order ID: ORD-${order.id.slice(0, 4).toUpperCase()}`}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6 py-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium">
                      {order?.user?.first_name} {order?.user?.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{order?.user?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Order Date</p>
                    <p className="font-medium">
                      {new Date(order?.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Badge className={STATUS_COLORS[order?.status] || ''}>
                      {order?.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {acceptableItems.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Active Items</h4>
                    {acceptableItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 border rounded-lg p-3"
                      >
                        {item.product?.image_url && (
                          <img
                            src={item.product.image_url}
                            alt={item.product?.name}
                            className="h-12 w-12 rounded object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {item.product?.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Qty: {item.quantity} × Rs. {parseFloat(item.unit_price?.toString() || '0').toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">
                            Rs. {parseFloat(item.total_amount?.toString() || '0').toFixed(2)}
                          </p>
                          {order?.status === 'pending' && (
                            <Dialog
                              open={cancelDialogOpen && cancellingItemId === item.id}
                              onOpenChange={(isOpen) => {
                                if (!isOpen) {
                                  setCancellingItemId(null);
                                  setCancellationReason('');
                                }
                                setCancelDialogOpen(isOpen);
                              }}
                            >
                              <DialogTrigger asChild>
                                <button
                                  onClick={() => {
                                    setCancellingItemId(item.id);
                                    setCancelDialogOpen(true);
                                  }}
                                  className="mt-1 text-xs text-red-600 hover:text-red-700"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Cancel Item</DialogTitle>
                                  <DialogDescription>
                                    Provide a reason for cancelling this item
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <Textarea
                                    placeholder="Enter cancellation reason..."
                                    value={cancellationReason}
                                    onChange={(e) =>
                                      setCancellationReason(e.target.value)
                                    }
                                    className="resize-none"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setCancelDialogOpen(false);
                                        setCancellingItemId(null);
                                        setCancellationReason('');
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={handleCancelItem}
                                    >
                                      Confirm Cancel
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {cancelledItems.length > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <h4 className="font-medium text-sm text-red-600">
                      Cancelled Items
                    </h4>
                    {cancelledItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 border border-red-200 rounded-lg p-3 bg-red-50"
                      >
                        <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-sm line-through">
                            {item.product?.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            Reason: {item.cancellation_reason || 'No reason provided'}
                          </p>
                        </div>
                        <p className="font-semibold text-sm text-red-600">
                          -Rs. {parseFloat(item.total_amount?.toString() || '0').toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shipping Address */}
            {order?.delivery_address && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Delivery Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-line">
                    {typeof order.delivery_address === 'string'
                      ? order.delivery_address
                      : JSON.stringify(order.delivery_address, null, 2)}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Original Total:</span>
                  <span className="font-medium">
                    Rs. {originalTotal.toFixed(2)}
                  </span>
                </div>
                {cancelledAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Cancelled Items:</span>
                    <span>-Rs. {cancelledAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between font-semibold text-lg">
                  <span>Current Total:</span>
                  <span className={cancelledAmount > 0 ? 'text-green-600' : ''}>
                    Rs. {currentTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-3">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-medium capitalize">
                    {order?.payment_method}
                  </span>
                </div>
                {order?.tracking_id && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tracking ID:</span>
                    <span className="font-mono text-sm">{order.tracking_id}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Accept Order Button */}
            {order?.status === 'pending' && acceptableItems.length > 0 && (
              <Button
                onClick={handleAcceptOrder}
                disabled={updateMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Accept Order & Pay Commission (Rs. ${currentTotal.toFixed(2)})`
                )}
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
