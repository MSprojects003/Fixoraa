// lib/api/orders.ts

import { createClient } from "@/lib/supabase/client";

// ---------- Types ----------
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type OrderItemStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

export interface OrderVendor {
  id: string;
  vendorName: string | null;
}

export interface OrderCustomer {
  id: string;
  fullName: string;
  profileImage: string | null;
  address: string | null;
  city: string | null;
  deliveryAddress: Record<string, unknown> | null;
  preferredLanguage: string | null;
  isActive: boolean;
  memberSince: string;
}

export interface OrderItemData {
  id: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
  status: OrderItemStatus;
  trackingId: string | null;
  cancellationReason: string | null;
}

export interface OrderDetail {
  id: string;
  vendor: OrderVendor | null;
  customer: OrderCustomer;
  items: OrderItemData[];
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: string;
  paymentReference: string | null;
  shippingAddress: string | null;
  trackId: string | null;
  createdAt: string;
  updatedAt: string;
  customer_id?: string | null;
  user_id?: string | null;
}

export interface OrderRow {
  id: string;
  orderNo: string;
  orderDate: string;
  customerName: string;
  totalAmount: number;
  itemCount: number;        // ← Number of different items
  status: OrderStatus;
}

export interface OrderFilters {
  search?: string;
  status?: OrderStatus | "all";
  vendorId?: string | null;
}

export interface VendorOrderCredits {
  plan: "basic" | "pro" | "premium";
  used: number;
  limit: number | null;
  remaining: number | null;
}

export function formatOrderNo(id: string) {
  return `ORD-${id.slice(0, 8).toUpperCase()}`;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(amount);
}

// ---------- Fetchers ----------

export async function fetchOrders(filters: OrderFilters = {}): Promise<OrderRow[]> {
  const supabase = createClient();

  let query = supabase
    .from("orders")
    .select(`
      *,
      customer:users!orders_user_id_fkey (id, first_name, last_name, email),
      order_items!order_items_order_id_fkey (id, quantity)
    `)
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.vendorId) {
    query = query.eq("vendor_id", filters.vendorId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Fetch orders error:", error);
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return (data ?? []).map((o: any) => {
    const customer = Array.isArray(o.customer) ? o.customer[0] : o.customer;

    const customerName = 
      [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
      customer?.email ||
      "Unknown customer";

    const items = o.order_items ?? [];

    return {
      id: o.id,
      orderNo: formatOrderNo(o.id),
      orderDate: o.created_at,
      customerName,
      totalAmount: Number(o.total_amount),
      itemCount: items.length,                    // ← Changed to array length (number of items)
      status: o.status as OrderStatus,
    };
  });
}

// Rest of the file remains the same
export async function fetchOrderById(id: string): Promise<OrderDetail> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      vendor:vendors!orders_vendor_id_fkey (id, vendor_name),
      customer_user:users!orders_user_id_fkey (
        id, first_name, last_name, email, profile_image, created_at
      ),
      customer_profile:customers!orders_customer_id_fkey (*),
      order_items!order_items_order_id_fkey (
        *,
        product:products!order_items_product_id_fkey (name, image_url, sku)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch order ${id}: ${error?.message}`);
  }

  const raw = data as any;
  const vendor = Array.isArray(raw.vendor) ? raw.vendor[0] : raw.vendor;

  const customerProfile = Array.isArray(raw.customer_profile) 
    ? raw.customer_profile[0] 
    : raw.customer_profile;

  const customerUser = Array.isArray(raw.customer_user) 
    ? raw.customer_user[0] 
    : raw.customer_user;

  const fullName =
    [customerUser?.first_name, customerUser?.last_name].filter(Boolean).join(" ") ||
    customerUser?.email ||
    "Unknown customer";

  return {
    id: raw.id,
    vendor: vendor ? { id: vendor.id, vendorName: vendor.vendor_name } : null,
    customer: {
      id: raw.customer_id || customerUser?.id,
      fullName,
      profileImage: customerUser?.profile_image ?? null,
      address: customerProfile?.address ?? null,
      city: customerProfile?.city ?? null,
      deliveryAddress: customerProfile?.delivery_address 
        ? (typeof customerProfile.delivery_address === 'string' 
            ? JSON.parse(customerProfile.delivery_address) 
            : customerProfile.delivery_address)
        : null,
      preferredLanguage: customerProfile?.preferred_language ?? null,
      isActive: customerProfile?.is_active ?? true,
      memberSince: customerUser?.created_at ?? raw.created_at,
    },
    items: (raw.order_items ?? []).map((it: any) => {
      const product = Array.isArray(it.product) ? it.product[0] : it.product;
      return {
        id: it.id,
        productId: it.product_id,
        name: product?.name ?? "Unknown product",
        imageUrl: product?.image_url ?? null,
        sku: product?.sku ?? null,
        unitPrice: Number(it.unit_price || 0),
        quantity: it.quantity,
        totalAmount: Number(it.total_amount || 0),
        status: it.status as OrderItemStatus,
        trackingId: it.tracking_id,
        cancellationReason: it.cancellation_reason,
      };
    }),
    totalAmount: Number(raw.total_amount),
    status: raw.status as OrderStatus,
    paymentMethod: raw.payment_method,
    paymentReference: raw.payment_reference,
    shippingAddress: raw.shipping_address,
    trackId: raw.track_id,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    customer_id: raw.customer_id,
    user_id: raw.user_id,
  };
}

export async function fetchVendorOrderCredits(vendorId: string): Promise<VendorOrderCredits> {
  const res = await fetch(`/api/vendor/order-credits?vendorId=${vendorId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch order credits");
  }
  return res.json();
}

// Mutations
export async function cancelOrderItem(
  itemId: string,
  reason: string
): Promise<{ newTotalAmount: number }> {
  const res = await fetch("/api/orders/items/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderItemId: itemId, reason }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to cancel item");
  }
  return res.json();
}

export async function acceptOrder(id: string, trackingId: string): Promise<void> {
  const res = await fetch("/api/orders/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, trackingId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to accept order");
  }

  const data = await res.json();

  if (data.paymentData) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = process.env.NEXT_PUBLIC_PAYHERE_ENV === "live" 
      ? "https://www.payhere.lk/pay/checkout" 
      : "https://sandbox.payhere.lk/pay/checkout";
    form.style.display = "none";

    Object.entries(data.paymentData).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  }
}