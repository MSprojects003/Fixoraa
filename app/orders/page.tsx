'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrders } from '@/lib/hooks/use-orders';
import { Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, isError, error } = useOrders(
    page,
    limit,
    status || undefined
  );

  const orders = data?.data || [];
  const pagination = data?.pagination;

  const filteredOrders = orders.filter((order) =>
    order.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Orders</h1>
        <p className="text-gray-600">Manage and track all customer orders</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Search</label>
              <Input
                placeholder="Search by email or order ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium mb-1">Status</label>
              <Select value={status || "all"} onValueChange={(val) => {
                setStatus(val === "all" ? "" : val);
                setPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-red-500">
              Error loading orders: {error?.message}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No orders found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">
                        {order.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {order.user?.first_name} {order.user?.last_name}
                          </span>
                          <span className="text-sm text-gray-500">
                            {order.user?.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        Rs. {parseFloat(order.total_amount.toString()).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {order.payment_method}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(order.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {order.order_items?.length || 0}
                      </TableCell>
                      <TableCell>
                        <Link href={`/orders/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-3">
            <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <div>
                Showing {filteredOrders.length === 0 ? 0 : (page - 1) * limit + 1} to{' '}
                {Math.min(page * limit, pagination?.total || 0)} of{' '}
                {pagination?.total || 0} orders
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <div className="flex items-center gap-2">
                  <span>Page</span>
                  <Input
                    type="number"
                    min="1"
                    max={pagination?.pages || 1}
                    value={page}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setPage(Math.min(val, pagination?.pages || 1));
                    }}
                    className="w-12"
                  />
                  <span>of {pagination?.pages || 1}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= (pagination?.pages || 1)}
                  onClick={() => setPage(p => Math.min(p + 1, pagination?.pages || 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
