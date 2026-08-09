// app/api/subscription/usage/route.ts
import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getSubscriptionUsageByUserId } from "@/lib/api/subscription-usage"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const usage = await getSubscriptionUsageByUserId(user.id)
    return NextResponse.json({ usage })
  } catch (error) {
    console.error("Failed to load subscription usage:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load subscription usage",
      },
      { status: 500 }
    )
  }
}