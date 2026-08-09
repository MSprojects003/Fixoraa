// lib/api/subscription-usage.ts
//
// Backend utilities for computing a vendor's subscription plan usage
// (orders, services, products, and "management" actions) against the
// limits defined by their current plan (basic / pro / premium).
//
// ASSUMPTIONS (adjust if they don't match your schema):
// 1. Supabase server client lives at "@/lib/supabase/server" and exposes
//    an async createClient(). Change the import below if yours differs.
// 2. There is a "products" table shaped like the "services" table you
//    shared (vendor_id, edit_tracking jsonb with a "billing_period" key).
//    If products actually live in the same "services" table (split by
//    `category`), swap PRODUCT_TABLE to "services" and add a category
//    filter in countRecords/sumEditTrackingForCurrentPeriod.
// 3. vendors.edit_tracking.counts holds profile-field edit counts
//    (first_name, last_name, address, ...) plus two special keys —
//    "addservice" and "addproduct" — which represent *creation* events.
//    Those two are folded into serviceManagement / productManagement
//    respectively rather than counted as profile edits.
// 4. "Management" usage = creation events (from vendors.edit_tracking)
//    + in-record edits (from services/products.edit_tracking) for the
//    current billing period (YYYY-MM, from timestamps in UTC).
// 5. order_credit_tracking.used already reflects the vendor's current
//    billing period order count (reset elsewhere, e.g. via a cron job
//    or DB trigger). This module treats it as-is unless its
//    period_start has rolled over to a previous month, in which case
//    it's treated as 0 (not yet reset in the DB).

import { createClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// Plan configuration
// ---------------------------------------------------------------------------

export type SubscriptionType = "basic" | "pro" | "premium"

export interface PlanLimits {
  label: string
  priceLKR: number
  commissionRatePercent: number
  services: number | "unlimited"
  products: number | "unlimited"
  profileManagement: number | "unlimited"
  serviceManagement: number | "unlimited"
  productManagement: number | "unlimited"
  recentCustomersVisible: number | "unlimited"
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionType, PlanLimits> = {
  basic: {
    label: "Basic",
    priceLKR: 40,
    commissionRatePercent: 15,
    services: 2,
    products: 3,
    profileManagement: 2,
    serviceManagement: 2,
    productManagement: 2,
    recentCustomersVisible: 0,
  },
  pro: {
    label: "Pro",
    priceLKR: 1500,
    commissionRatePercent: 13,
    services: 5,
    products: 10,
    profileManagement: 10,
    serviceManagement: 10,
    productManagement: 10,
    recentCustomersVisible: 5,
  },
  premium: {
    label: "Premium",
    priceLKR: 3500,
    commissionRatePercent: 13,
    services: "unlimited",
    products: "unlimited",
    profileManagement: "unlimited",
    serviceManagement: "unlimited",
    productManagement: "unlimited",
    recentCustomersVisible: "unlimited",
  },
}

const SERVICE_TABLE = "services"
const PRODUCT_TABLE = "products" // see assumption #2 above

// ---------------------------------------------------------------------------
// Row shapes (only the columns this module cares about)
// ---------------------------------------------------------------------------

interface VendorEditTracking {
  counts: Record<string, number>
  period_start: string
}

interface VendorOrderCreditTracking {
  used: number
  period_start: string
}

export interface VendorUsageRow {
  id: string
  user_id: string
  subscription_type: SubscriptionType | null
  has_subscription: boolean
  edit_tracking: VendorEditTracking | null
  order_credit_tracking: VendorOrderCreditTracking | null
}

interface RecordEditTracking {
  billing_period: string
  [field: string]: number | string
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Supabase sometimes returns jsonb columns as already-parsed objects and
 * sometimes (e.g. via raw SQL / views) as JSON strings. Normalize both. */
function parseJsonColumn<T>(value: unknown): T | null {
  if (value == null) return null
  if (typeof value === "object") return value as T
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }
  return null
}

/** Current billing period as "YYYY-MM", matching the format stored in
 * services/products.edit_tracking.billing_period. */
function getCurrentBillingPeriod(referenceDate: Date = new Date()): string {
  const year = referenceDate.getUTCFullYear()
  const month = String(referenceDate.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

/** True if an ISO timestamp falls in the same UTC year+month as the
 * current billing period. Used to guard against stale (not-yet-reset)
 * counters after a billing period rolls over. */
function isWithinCurrentPeriod(periodStartIso: string | undefined): boolean {
  if (!periodStartIso) return false
  const d = new Date(periodStartIso)
  if (Number.isNaN(d.getTime())) return false
  return getCurrentBillingPeriod(d) === getCurrentBillingPeriod()
}

function sumNumericValues(obj: Record<string, unknown> | undefined, excludeKeys: string[] = []): number {
  if (!obj) return 0
  return Object.entries(obj).reduce((total, [key, value]) => {
    if (excludeKeys.includes(key)) return total
    return typeof value === "number" ? total + value : total
  }, 0)
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

async function getVendorById(vendorId: string): Promise<VendorUsageRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("vendors")
    .select("id, user_id, subscription_type, has_subscription, edit_tracking, order_credit_tracking")
    .eq("id", vendorId)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null // no rows
    throw error
  }

  return {
    ...data,
    edit_tracking: parseJsonColumn<VendorEditTracking>(data.edit_tracking),
    order_credit_tracking: parseJsonColumn<VendorOrderCreditTracking>(data.order_credit_tracking),
  }
}

async function countRecords(table: typeof SERVICE_TABLE | typeof PRODUCT_TABLE, vendorId: string): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId)

  if (error) throw error
  return count ?? 0
}

/** Sums every numeric field inside each record's edit_tracking for the
 * current billing period (i.e. "how many edits happened to my services /
 * products this period"). */
async function sumEditTrackingForCurrentPeriod(
  table: typeof SERVICE_TABLE | typeof PRODUCT_TABLE,
  vendorId: string,
  currentPeriod: string
): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from(table)
    .select("edit_tracking")
    .eq("vendor_id", vendorId)

  if (error) throw error

  let total = 0
  for (const row of data ?? []) {
    const tracking = parseJsonColumn<RecordEditTracking>((row as { edit_tracking: unknown }).edit_tracking)
    if (!tracking || tracking.billing_period !== currentPeriod) continue
    total += sumNumericValues(tracking, ["billing_period"])
  }
  return total
}

// ---------------------------------------------------------------------------
// Usage summary
// ---------------------------------------------------------------------------

export interface UsageMetric {
  label: string
  used: number
  limit: number | "unlimited"
  percentage: number // 0–100, 0 for unlimited
  isUnlimited: boolean
  isAtLimit: boolean
}

export interface SubscriptionUsageSummary {
  vendorId: string
  subscriptionType: SubscriptionType
  planLimits: PlanLimits
  billingPeriod: string
  metrics: {
    orders: UsageMetric
    services: UsageMetric
    products: UsageMetric
    profileManagement: UsageMetric
    serviceManagement: UsageMetric
    productManagement: UsageMetric
  }
}

function buildMetric(label: string, used: number, limit: number | "unlimited"): UsageMetric {
  const isUnlimited = limit === "unlimited"
  const percentage = isUnlimited
    ? 0
    : limit === 0
      ? 100
      : Math.min(100, Math.round((used / limit) * 100))

  return {
    label,
    used,
    limit,
    percentage,
    isUnlimited,
    isAtLimit: !isUnlimited && used >= (limit as number),
  }
}

export async function getSubscriptionUsage(vendorId: string): Promise<SubscriptionUsageSummary> {
  const vendor = await getVendorById(vendorId)
  if (!vendor) {
    throw new Error(`Vendor not found for id: ${vendorId}`)
  }

  const subscriptionType: SubscriptionType = vendor.subscription_type ?? "basic"
  const plan = SUBSCRIPTION_PLANS[subscriptionType]
  const currentPeriod = getCurrentBillingPeriod()

  const [servicesCount, productsCount, serviceEditsThisPeriod, productEditsThisPeriod] = await Promise.all([
    countRecords(SERVICE_TABLE, vendorId),
    countRecords(PRODUCT_TABLE, vendorId),
    sumEditTrackingForCurrentPeriod(SERVICE_TABLE, vendorId, currentPeriod),
    sumEditTrackingForCurrentPeriod(PRODUCT_TABLE, vendorId, currentPeriod),
  ])

  const orderCreditsUsed =
    vendor.order_credit_tracking && isWithinCurrentPeriod(vendor.order_credit_tracking.period_start)
      ? vendor.order_credit_tracking.used
      : 0

  const vendorEditsInPeriod =
    vendor.edit_tracking && isWithinCurrentPeriod(vendor.edit_tracking.period_start)
      ? vendor.edit_tracking.counts
      : {}

  const profileManagementUsed = sumNumericValues(vendorEditsInPeriod, ["addservice", "addproduct"])
  const serviceCreationsUsed = typeof vendorEditsInPeriod.addservice === "number" ? vendorEditsInPeriod.addservice : 0
  const productCreationsUsed = typeof vendorEditsInPeriod.addproduct === "number" ? vendorEditsInPeriod.addproduct : 0

  // Orders don't have a fixed plan limit in the pricing table you shared
  // (only a commission rate), so this metric is informational only —
  // treat it as "unlimited" unless you introduce a per-plan order cap.
  const orderLimit: number | "unlimited" = "unlimited"

  return {
    vendorId,
    subscriptionType,
    planLimits: plan,
    billingPeriod: currentPeriod,
    metrics: {
      orders: buildMetric("Orders this period", orderCreditsUsed, orderLimit),
      services: buildMetric("Services listed", servicesCount, plan.services),
      products: buildMetric("Products listed", productsCount, plan.products),
      profileManagement: buildMetric("Profile management", profileManagementUsed, plan.profileManagement),
      serviceManagement: buildMetric(
        "Service management",
        serviceCreationsUsed + serviceEditsThisPeriod,
        plan.serviceManagement
      ),
      productManagement: buildMetric(
        "Product management",
        productCreationsUsed + productEditsThisPeriod,
        plan.productManagement
      ),
    },
  }
}

/** Convenience lookup when you only have the user's id (e.g. from auth
 * session) rather than the vendor row id. */
export async function getSubscriptionUsageByUserId(userId: string): Promise<SubscriptionUsageSummary> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("vendors")
    .select("id")
    .eq("user_id", userId)
    .single()

  if (error) throw error
  if (!data) throw new Error(`No vendor found for user_id: ${userId}`)

  return getSubscriptionUsage(data.id)
}