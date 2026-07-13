// lib/api/reservations.ts
//
// Data access layer for service_reservations, joined against:
//  - users (customer_id -> customer's name; address/city, see note below)
//  - vendors (vendor_id -> vendor name, for admin/multi-vendor views)
//  - services (service_id -> service name)

import { createClient } from "@/lib/supabase/client";
 

// ---------- Types ----------

export type ReservationStatus = "pending" | "accepted" | "cancelled";
export type PaymentMethod = "cash" | "card";

export interface ServiceReservation {
  id: string;
  service_id: string;
  vendor_id: string;
  customer_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  people_count: number;
  status: ReservationStatus;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  total_amount: number;
  final_vendor_total_amount: number | null;
  created_at: string;
  updated_at: string;
  vendor_start_time: string | null;
  vendor_end_time: string | null;
  cancellation_reason: string | null;
}

export interface ReservationCustomer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export interface ReservationVendor {
  id: string;
  vendor_name: string | null;
  branch: string | null;
}

export interface ReservationService {
  id: string;
  name: string;
  category: string;
  price: number;
  price_type: "fixed" | "hourly";
  image_url: string | null;
}

export interface ReservationWithRelations extends ServiceReservation {
  customer: ReservationCustomer;
  vendor: ReservationVendor;
  service: ReservationService;
}

export interface ReservationRow {
  id: string;
  reservationNo: string;
  customerName: string;
  serviceName: string;
  createdAt: string;
  requestedDate: string;
  timeRange: string;
  status: ReservationStatus;
  totalAmount: number;
  finalVendorTotalAmount: number | null;
}

export interface ReservationFilters {
  search?: string;
  status?: ReservationStatus | "all";
  vendorId?: string;
}

const SELECT_WITH_RELATIONS = `
  *,
  customer:users!service_reservations_customer_id_fkey (
    id, first_name, last_name, email
  ),
  vendor:vendors!service_reservations_vendor_id_fkey (
    id, vendor_name, branch
  ),
  service:services!service_reservations_service_id_fkey (
    id, name, category, price, price_type, image_url
  )
`;

// ---------- Fetchers ----------

export async function fetchReservations(
  filters: ReservationFilters = {}
): Promise<ReservationWithRelations[]> {
  const supabase = createClient();

  let query = supabase
    .from("service_reservations")
    .select(SELECT_WITH_RELATIONS)
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.vendorId) {
    query = query.eq("vendor_id", filters.vendorId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch reservations: ${error.message}`);
  }

  return (data ?? []) as unknown as ReservationWithRelations[];
}

export async function fetchReservationById(
  id: string
): Promise<ReservationWithRelations> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("service_reservations")
    .select(SELECT_WITH_RELATIONS)
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch reservation ${id}: ${error.message}`);
  }

  return data as unknown as ReservationWithRelations;
}

// ---------- Mutations ----------

export async function updateReservationStatus(
  id: string,
  status: ReservationStatus,
  cancellationReason?: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("service_reservations")
    .update({
      status,
      cancellation_reason: status === "cancelled" ? cancellationReason ?? null : null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update reservation status: ${error.message}`);
  }
}

export interface AcceptReservationPayload {
  vendorStartTime: string; // "HH:MM" or "HH:MM:SS"
  vendorEndTime: string;
  finalVendorTotalAmount: number;
}

// Accepts a reservation and redirects to PayHere payment for commission.
// The server endpoint returns PayHere payment form data, which we then
// submit via a hidden form to redirect the user to PayHere checkout.
export async function acceptReservation(
  id: string,
  payload: AcceptReservationPayload
): Promise<void> {
  const res = await fetch("/api/reservations/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      vendorStartTime: payload.vendorStartTime,
      vendorEndTime: payload.vendorEndTime,
      finalVendorTotalAmount: payload.finalVendorTotalAmount,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to accept reservation");
  }

  const data = await res.json();

  if (data.paymentData) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://sandbox.payhere.lk/pay/checkout";
    form.target = "_blank"; // Open in new tab
    if (process.env.NEXT_PUBLIC_PAYHERE_ENV === "live") {
      form.action = "https://www.payhere.lk/pay/checkout";
    }
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
    
    // Clean up form after submission
    document.body.removeChild(form);
  }
}

export async function rejectReservation(
  id: string,
  cancellationReason: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("service_reservations")
    .update({
      status: "cancelled" satisfies ReservationStatus,
      cancellation_reason: cancellationReason,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to reject reservation: ${error.message}`);
  }
}

export async function setFinalVendorTotalAmount(
  id: string,
  amount: number
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("service_reservations")
    .update({ final_vendor_total_amount: amount })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to set final vendor total: ${error.message}`);
  }
}

// ---------- Mapping helpers ----------

function formatTimeRange(start: string, end: string): string {
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

export function toReservationRow(r: ReservationWithRelations): ReservationRow {
  const customerName =
    [r.customer?.first_name, r.customer?.last_name].filter(Boolean).join(" ") ||
    r.customer?.email ||
    "Unknown customer";

  return {
    id: r.id,
    reservationNo: `RSV-${r.id.slice(0, 8).toUpperCase()}`,
    customerName,
    serviceName: r.service?.name ?? "Unknown service",
    createdAt: r.created_at,
    requestedDate: r.reservation_date,
    timeRange: formatTimeRange(r.start_time, r.end_time),
    status: r.status,
    totalAmount: r.total_amount,
    finalVendorTotalAmount: r.final_vendor_total_amount,
  };
}
