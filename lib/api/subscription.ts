import { createClient } from '@/lib/supabase/client';

export type PlanType = 'basic' | 'pro' | 'premium';

const PLAN_AMOUNTS: Record<PlanType, number> = {
  basic: 0.10,
  pro: 1500.00,
  premium: 3500.00,
};

export interface ActivateSubscriptionParams {
  vendorId: string;
  userId: string;
  planType: PlanType;
  payhereOrderId: string;
  payherePaymentId?: string;
  currency?: string;
}

export interface SubscriptionResult {
  success: boolean;
  error?: string;
}

export async function activateSubscription(
  params: ActivateSubscriptionParams
): Promise<SubscriptionResult> {
  const res = await fetch('/api/payment/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();

  if (!res.ok) {
    return { success: false, error: data.error || 'Activation failed' };
  }

  return { success: true };
}

// Call this after PayHere returns to success page
// to check current subscription status from DB
export async function fetchVendorSubscription(vendorId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

// Enforce: null subscription_type = has_subscription false
export async function syncVendorSubscriptionStatus(vendorId: string) {
  const supabase = createClient();

  const { data: vendor } = await supabase
    .from('vendors')
    .select('subscription_type, has_subscription')
    .eq('id', vendorId)
    .single();

  if (!vendor) return;

  // If subscription_type is null, force has_subscription to false
  if (!vendor.subscription_type && vendor.has_subscription) {
    await supabase
      .from('vendors')
      .update({ has_subscription: false })
      .eq('id', vendorId);
  }

  // If subscription_type is set, force has_subscription to true
  if (vendor.subscription_type && !vendor.has_subscription) {
    await supabase
      .from('vendors')
      .update({ has_subscription: true })
      .eq('id', vendorId);
  }
}