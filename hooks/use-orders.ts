// hooks/use-orders.ts
//
// Mirrors hooks/use-reservations.ts's structure exactly.
// ADDED: useVendorOrderCredits() for the "Pro | 9 credits available"
// header badge.

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchOrders,
  fetchOrderById,
  cancelOrderItem,
  acceptOrder,
  fetchVendorOrderCredits,
  type OrderFilters,
  type OrderRow,
} from "@/lib/api/orders";

const ORDERS_KEY = "orders" as const;
const VENDOR_CREDITS_KEY = "vendor-order-credits" as const;

export function useOrders(filters: OrderFilters = {}) {
  const { search, status = "all", vendorId } = filters;
  const query = useQuery({
    queryKey: [ORDERS_KEY, { status, vendorId }],
    queryFn: () => fetchOrders({ status, vendorId }),
    enabled: vendorId !== null,
    staleTime: 30_000,
  });
  const rows: OrderRow[] = useMemo(() => {
    const all = query.data ?? [];
    if (!search?.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter(
      (r) => r.orderNo.toLowerCase().includes(q) || r.customerName.toLowerCase().includes(q)
    );
  }, [query.data, search]);
  return { ...query, orders: query.data ?? [], rows };
}

// Fetches the full detail (customer, vendor, items) for the sheet —
// only enabled once an id is actually selected.
export function useOrderDetail(id: string | null) {
  return useQuery({
    queryKey: [ORDERS_KEY, "detail", id],
    queryFn: () => fetchOrderById(id as string),
    enabled: !!id,
  });
}

export function useCancelOrderItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) =>
      cancelOrderItem(itemId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_KEY, 'detail'] });
    },
  });
}

export function useAcceptOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, trackingId }: { id: string; trackingId: string }) =>
      acceptOrder(id, trackingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [ORDERS_KEY, 'detail'] });
      queryClient.invalidateQueries({ queryKey: [VENDOR_CREDITS_KEY] });
    },
  });
}

// Powers the header badge: "Pro | 9 credits available". Pass the
// current vendor's id (from your auth/vendor context) — disabled
// until one is available.
export function useVendorOrderCredits(vendorId: string | null | undefined) {
  return useQuery({
    queryKey: [VENDOR_CREDITS_KEY, vendorId],
    queryFn: () => fetchVendorOrderCredits(vendorId as string),
    enabled: !!vendorId,
    staleTime: 15_000,
  });
}