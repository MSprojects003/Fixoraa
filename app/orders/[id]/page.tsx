'use client';

import React, { useState } from 'react';
import { useOrder, useUpdateOrder } from '@/lib/hooks/use-orders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const { data, isLoading, isError } = useOrder(params.id);
  const updateMutation = useUpdateOrder(params.id);
  
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    status: '',
    track_id: '',
    shipping_address: '',
  });

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
                {order.order_items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between pb-4 border-b last:border-b-0"
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
                <Input
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
                {!editMode && (
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
                    value={formData.status || "pending"}
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
                <p className="text-sm text-gray-500 mb-2">Total Amount</p>
                <p className="text-2xl font-bold">
                  Rs. {parseFloat(order.total_amount.toString()).toFixed(2)}
                </p>
              </div>

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
            </CardContent>
          </Card>

          {order.vendor && (
            <Card>
              <CardHeader>
                <CardTitle>Vendor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{order.vendor.business_name}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
