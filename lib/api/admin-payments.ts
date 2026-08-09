// lib/api/admin-payments.ts

export type PaymentMethod = 'card' | 'bank_transfer' | 'cash';
export type PaymentTypeFilter = 'all' | 'subscription' | 'order' | 'reservation';

export interface AdminPaymentUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export interface AdminPayment {
  id: string;
  user_id: string;
  created_at: string;
  payment_amount: number;
  payment_method: PaymentMethod;
  reciept_image_url: string | null;
  payment_details: Record<string, unknown> | null;
  reference: string | null;
  order_id: string | null;
  reservation_id: string | null;
  is_subscription_payment: boolean;
  is_order_payment: boolean;
  is_reservation_payment: boolean;
  user: AdminPaymentUser | null;
}

export interface AdminPaymentRow {
  id: string;
  customerName: string;
  createdAt: string;
  amount: number;
  method: PaymentMethod;
  type: 'Subscription' | 'Order' | 'Reservation' | 'Other';
  reference: string;
  receiptUrl: string | null;
}

// Points at app/api/payment/admin/route.ts
export async function fetchAdminPayments(
  type: PaymentTypeFilter = 'all'
): Promise<AdminPayment[]> {
  const query = type !== 'all' ? `?type=${type}` : '';
  const res = await fetch(`/api/payment/admin${query}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch payments');
  }

  const { payments } = await res.json();
  return payments as AdminPayment[];
}

export function toAdminPaymentRow(p: AdminPayment): AdminPaymentRow {
  const customerName =
    [p.user?.first_name, p.user?.last_name].filter(Boolean).join(' ') ||
    p.user?.email ||
    'Unknown user';

  const type = p.is_subscription_payment
    ? 'Subscription'
    : p.is_order_payment
    ? 'Order'
    : p.is_reservation_payment
    ? 'Reservation'
    : 'Other';

  return {
    id: p.id,
    customerName,
    createdAt: p.created_at,
    amount: p.payment_amount,
    method: p.payment_method,
    type,
    reference: p.reference || p.order_id || '—',
    receiptUrl: p.reciept_image_url,
  };
}