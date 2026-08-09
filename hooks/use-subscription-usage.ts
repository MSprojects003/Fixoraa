// hooks/use-subscription-usage.ts
"use client"

import { useQuery } from "@tanstack/react-query"
import type { SubscriptionUsageSummary } from "@/lib/api/subscription-usage"

const SUBSCRIPTION_USAGE_KEY = "subscription-usage" as const

async function fetchSubscriptionUsage(): Promise<SubscriptionUsageSummary> {
  const res = await fetch("/api/subscription/usage")

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Failed to fetch subscription usage")
  }

  const { usage } = await res.json()
  return usage as SubscriptionUsageSummary
}

export function useSubscriptionUsage() {
  return useQuery({
    queryKey: [SUBSCRIPTION_USAGE_KEY],
    queryFn: fetchSubscriptionUsage,
    staleTime: 30_000,
  })
}