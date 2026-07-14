'use client';

import React, { useState } from 'react';
import { useOrder, useUpdateOrder } from '@/lib/hooks/use-orders';
import { useOrderPaymentCallback } from '@/lib/hooks/use-order-payment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';
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

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const { data, isLoading, isError, refetch } = useOrder(params.id);
  const updateMutation = useUpdateOrder(params.id);
  useOrderPaymentCallback(); // Handle PayHere callback
  
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    status: '',
    track_id: '',
    shipping_address: '',
  });

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingItemId, setCancellingItemId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellingItem, setCancellingItem] = useState(false);
  const [acceptingOrder, setAcceptingOrder] = useState(false);

  const order = data?.data;

  React.useEffect(() => {
    if (order) {
      setFormData({
        status: order.status,
        track_id: order.track_id || '',
        shipping_address: order.shipping_address || '',
      });
    }
  }, [order]);

  // Calculate total for non-cancelled items
  const calculateTotal = () => {
    if (!order?.order_items) return 0;
    return order.order_items
      .filter((item: any) => item.status !== 'cancelled')
      .reduce((sum: number, item: any) => sum + parseFloat(item.total_amount || 0), 0);
  };

  // Handle item cancellation
  const handleCancelItem = async () => {
    if (!cancellingItemId || !cancellationReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }

    setCancellingItem(true);
    try {
      const response = await fetch(`/api/orders/${params.id}/items/${cancellingItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          cancellation_reason: cancellationReason,
        }),
      });

      if (!response.ok) throw new Error('Failed to cancel item');

      toast.success('Order item cancelled');
      setCancelDialogOpen(false);
      setCancellingItemId(null);
      setCancellationReason('');
      refetch();
    } catch (error) {
      toast.error('Failed to cancel item');
      console.error('[cancel-item] Error:', error);
    } finally {
      setCancellingItem(false);
    }
  };

  // Handle order acceptance with PayHere payment
  const handleAcceptOrder = async () => {
    if (!order) return;

    const acceptableItems = order.order_items?.filter((item: any) => item.status !== 'cancelled') || [];
    if (acceptableItems.length === 0) {
      toast.error('No items to accept');
      return;
    }

    setAcceptingOrder(true);
    try {
      // Calculate new total (excluding cancelled items)
      const newTotal = calculateTotal();
      
      // Get vendor subscription type for commission calculation
      const commissionRates: Record<string, number> = {
        basic: 0.15, // 15%
        pro: 0.13,   // 13%
        premium: 0.13, // 13%
      };
      
      // For now, assume default plan is 'basic'
      const subscriptionType = 'basic';
      const commissionRate = commissionRates[subscriptionType] || 0.15;
      const commissionAmount = newTotal * commissionRate;

      // Prepare PayHere form data
      const paymentData = {
        merchant_id: process.env.NEXT_PUBLIC_PAYHERE_MERCHANT_ID,
        return_url: `${window.location.origin}/orders/${params.id}?payment=success`,
        cancel_url: `${window.location.origin}/orders/${params.id}?payment=cancelled`,
        notify_url: `${window.location.origin}/api/payment/notify`,
        order_id: `ORDER_${params.id}_${Date.now()}`,
        items: `Order #${order.id}`,
        amount: commissionAmount.toFixed(2),
        currency: 'LKR',
        first_name: order.user?.first_name || 'Customer',
        last_name: order.user?.last_name || '',
        email: order.user?.email || '',
        phone: order.user?.phone || '',
        address: order.shipping_address || '',
        city: 'N/A',
        country: 'LK',
        custom_1: params.id,
        custom_2: subscriptionType,
      };

      // Generate hash for PayHere
      const hashString = `${paymentData.merchant_id}${paymentData.order_id}${paymentData.amount}${paymentData.currency}${paymentData.first_name}${paymentData.email}`.toLowerCase();
      const crypto = await import('crypto');
      const hash = crypto.createHash('md5').update(hashString).digest('hex');
      paymentData.hash = hash;

      // Store order acceptance data in localStorage
      localStorage.setItem('payhere_order_acceptance', JSON.stringify({
        orderId: params.id,
        newTotal,
        commissionAmount,
        subscriptionType,
        acceptableItemIds: acceptableItems.map((item: any) => item.id),
      }));

      // Create and submit PayHere form
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = process.env.NEXT_PUBLIC_PAYHERE_ENV === 'live'
        ? 'https://www.payhere.lk/pay/checkout'
        : 'https://sandbox.payhere.lk/pay/checkout';
      form.target = '_blank';
      form.style.display = 'none';

      Object.entries(paymentData).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      toast.success('Opening PayHere payment...');
    } catch (error) {
      toast.error('Failed to process payment');
      console.error('[accept-order] Error:', error);
    } finally {
      setAcceptingOrder(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await updateMutation.mutateAsync({
        status: formData.status,
        track_id: formData.track_id,
        shipping_address: formData.shipping_address,
      });
      toast.success('Order updated successfully');
      setEditMode(false);
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="p-6">
        <div className="text-center text-red-500">Order not found</div>
      </div>
    );
  }

  const newTotal = calculateTotal();
  const hasAcceptableItems = order.order_items?.some((item: any) => item.status !== 'cancelled');

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Order Details</h1>
          <p className="text-gray-600 font-mono text-sm">{order.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium">
                    {order.user?.first_name} {order.user?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{order.user?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{order.user?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Order Date</p>
                  <p className="font-medium">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.order_items?.map((item: any) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between pb-4 border-b last:border-b-0 ${
                      item.status === 'cancelled' ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex-1">
                      {item.product?.image_url && (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="h-12 w-12 rounded object-cover mb-2"
                        />
                      )}
                      <p className="font-medium">{item.product?.name}</p>
                      <p className="text-sm text-gray-500">
                        Qty: {item.quantity} × Rs.{' '}
                        {parseFloat(item.unit_price.toString()).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold">
                          Rs. {parseFloat(item.total_amount.toString()).toFixed(2)}
                        </p>
                        {item.status && (
                          <Badge className="mt-1" variant="outline">
                            {item.status}
                          </Badge>
                        )}
                      </div>
                      {item.status !== 'cancelled' && order.status === 'pending' && (
                        <button
                          onClick={() => {
                            setCancellingItemId(item.id);
                            setCancelDialogOpen(true);
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent>
              {editMode ? (
                <Textarea
                  value={formData.shipping_address}
                  onChange={(e) =>
                    setFormData({ ...formData, shipping_address: e.target.value })
                  }
                  placeholder="Enter shipping address"
                />
              ) : (
                <p className="whitespace-pre-wrap">
                  {order.shipping_address || 'No address provided'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Order Summary</span>
                {!editMode && order.status === 'pending' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMode(true)}
                  >
                    Edit
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">Status</p>
                {editMode ? (
                  <Select
                    value={formData.status || 'pending'}
                    onValueChange={(val) =>
                      setFormData({ ...formData, status: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    className={
                      STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'
                    }
                  >
                    {order.status}
                  </Badge>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Original Total</p>
                <p className="text-lg font-semibold line-through text-gray-500">
                  Rs. {parseFloat(order.total_amount.toString()).toFixed(2)}
                </p>
              </div>

              {newTotal !== parseFloat(order.total_amount.toString()) && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Updated Total (after cancellations)</p>
                  <p className="text-2xl font-bold text-green-600">
                    Rs. {newTotal.toFixed(2)}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500 mb-2">Payment Method</p>
                <p className="font-medium capitalize">{order.payment_method}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Payment Reference</p>
                <p className="font-mono text-sm">
                  {order.payment_reference || 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Tracking ID</p>
                {editMode ? (
                  <Input
                    value={formData.track_id}
                    onChange={(e) =>
                      setFormData({ ...formData, track_id: e.target.value })
                    }
                    placeholder="Enter tracking ID"
                  />
                ) : (
                  <p className="font-mono text-sm">{order.track_id || 'N/A'}</p>
                )}
              </div>

              {editMode && (
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleUpdate}
                    disabled={updateMutation.isPending}
                    className="flex-1"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditMode(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {order.status === 'pending' && hasAcceptableItems && (
                <Button
                  onClick={handleAcceptOrder}
                  disabled={acceptingOrder}
                  className="w-full bg-green-600 hover:bg-green-700 mt-4"
                >
                  {acceptingOrder ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Accept Order & Pay Commission'
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancellation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order Item</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this item.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            placeholder="Enter cancellation reason..."
            className="min-h-24"
          />
          <DialogFooter>
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
              disabled={cancellingItem}
            >
              {cancellingItem ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
