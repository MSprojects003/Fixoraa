'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status?: string;
  tracking_id?: string;
  product?: {
    id: string;
    name: string;
    image_url?: string;
    price: number;
  };
}

interface Order {
  id: string;
  user_id: string;
  vendor_id?: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_method: string;
  payment_reference?: string;
  shipping_address?: string;
  track_id?: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email: string;
    phone?: string;
  };
  vendor?: {
    id: string;
    business_name: string;
  };
  order_items?: OrderItem[];
}

interface OrdersResponse {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function useOrders(page = 1, limit = 10, status?: string, userId?: string) {
  const queryString = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(status && { status }),
    ...(userId && { user_id: userId }),
  }).toString();

  return useQuery<OrdersResponse>({
    queryKey: ['orders', page, limit, status, userId],
    queryFn: async () => {
      const response = await fetch(`/api/orders?${queryString}`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
  });
}

export function useOrder(id: string) {
  return useQuery<{ data: Order }>({
    queryKey: ['order', id],
    queryFn: async () => {
      const response = await fetch(`/api/orders/${id}`);
      if (!response.ok) throw new Error('Failed to fetch order');
      return response.json();
    },
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: {
      user_id: string;
      vendor_id?: string;
      total_amount: number;
      payment_method: string;
      payment_reference?: string;
      shipping_address?: string;
      order_items: {
        product_id: string;
        quantity: number;
        unit_price: number;
        total_amount: number;
      }[];
    }) => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      if (!response.ok) throw new Error('Failed to create order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOrder(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: {
      status?: string;
      payment_reference?: string;
      shipping_address?: string;
      track_id?: string;
    }) => {
      const response = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/orders/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
