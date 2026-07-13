export const PAYHERE_BASE_URL =
  process.env.NEXT_PUBLIC_PAYHERE_BASE_URL || 'https://sandbox.payhere.lk/pay/checkout';

export const MERCHANT_ID =
  process.env.NEXT_PUBLIC_PAYHERE_MERCHANT_ID || '';

export interface PayHerePaymentData {
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  amount: string;
  currency: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  custom_1: string;
  custom_2: string;
  hash: string;
}

export async function generateHashFromServer(
  orderId: string,
  amount: string,
  currency: string = 'LKR'
): Promise<string> {
  const res = await fetch('/api/payment/hash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchantId: MERCHANT_ID, orderId, amount, currency }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate payment hash');
  }
  const { hash } = await res.json();
  return hash;
}

export async function createPayHerePaymentData(
  planId: string,
  amount: string,
  vendorId: string,
  userId: string,
  userData: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
  },
  returnUrl: string,
  cancelUrl: string,
  notifyUrl: string
): Promise<PayHerePaymentData> {
  const formattedAmount = parseFloat(amount).toFixed(2);
  const currency = 'LKR';
  const orderId = `SUB-${planId}-${Date.now()}`;

  const hash = await generateHashFromServer(orderId, formattedAmount, currency);

  return {
    merchant_id: MERCHANT_ID,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    order_id: orderId,
    items: `Subscription - ${planId}`,
    amount: formattedAmount,
    currency,
    first_name: userData.first_name,
    last_name: userData.last_name,
    email: userData.email,
    phone: userData.phone,
    address: userData.address,
    city: userData.city,
    country: userData.country,
    custom_1: vendorId,
    custom_2: userId,
    hash,
  };
}

// ---------- Reservation commission payment ----------
//
// When a vendor accepts a reservation, the platform charges them a
// commission (rate depends on their subscription plan — see
// lib/reservation-commission.ts). This builds the PayHere payload for
// THAT charge. order_id is prefixed "RSVPAY_" (underscore-separated,
// not hyphen — the reservation id is a UUID full of hyphens, so the
// notify webhook needs an unambiguous separator to pull it back out).
//
// custom_1 = vendorId, custom_2 = reservationId — both read back out
// in app/api/payment/notify/route.ts once PayHere confirms payment.
export async function createReservationCommissionPaymentData(
  reservationId: string,
  vendorId: string,
  commissionAmount: number,
  payerData: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
  },
  returnUrl: string,
  cancelUrl: string,
  notifyUrl: string
): Promise<PayHerePaymentData> {
  const formattedAmount = commissionAmount.toFixed(2);
  const currency = 'LKR';
  const orderId = `RSVPAY_${reservationId}_${Date.now()}`;

  const hash = await generateHashFromServer(orderId, formattedAmount, currency);

  return {
    merchant_id: MERCHANT_ID,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    order_id: orderId,
    items: `Reservation commission - ${reservationId.slice(0, 8).toUpperCase()}`,
    amount: formattedAmount,
    currency,
    first_name: payerData.first_name,
    last_name: payerData.last_name,
    email: payerData.email,
    phone: payerData.phone,
    address: payerData.address,
    city: payerData.city,
    country: payerData.country,
    custom_1: vendorId,
    custom_2: reservationId,
    hash,
  };
}

// Builds PayHere's required hidden form and submits it, redirecting the
// browser to the sandbox checkout. Shared by the subscription flow and
// the reservation commission flow so the redirect logic only lives once.
export function submitPayHereForm(formEl: HTMLFormElement, data: PayHerePaymentData) {
  formEl.innerHTML = '';
  Object.entries(data).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = String(value);
    formEl.appendChild(input);
  });
  formEl.submit();
}