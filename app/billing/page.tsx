"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  Download,
  Loader2,
  AlertTriangle,
  CreditCard,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useAdminPayments } from "@/hooks/use-admin-payments"
import { useSubscriptionUsage } from "@/hooks/use-subscription-usage"
import type { PaymentMethod } from "@/lib/api/admin-payments"

// ---- Formatting helpers ----

type MethodFilter = "all" | PaymentMethod

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function formatCurrency(amount: number) {
  return `Rs. ${currencyFormatter.format(amount)}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/** billingPeriod comes back as "YYYY-MM" from the usage API */
function formatBillingPeriod(period: string) {
  const [year, month] = period.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleDateString("en-LK", { year: "numeric", month: "long" })
}

function formatMethodLabel(method: string) {
  return method.replace("_", " ")
}

export default function BillingPage() {
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all")

  const {
    data: usage,
    isLoading: isUsageLoading,
    isError: isUsageError,
  } = useSubscriptionUsage()

  // Billing page only cares about subscription invoices — order/reservation
  // payments show up wherever those flows are managed.
  const {
    rows: invoiceRows,
    payments,
    isLoading: isPaymentsLoading,
    isError: isPaymentsError,
  } = useAdminPayments("subscription")

  const filteredInvoices =
    methodFilter === "all"
      ? invoiceRows
      : invoiceRows.filter((row) => row.method === methodFilter)

  // Assumes the API returns payments ordered most-recent-first.
  const mostRecentPayment = payments[0]

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your plan, payment history, and usage limits.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Current plan */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isUsageLoading
                  ? "Loading plan…"
                  : `${usage?.planLimits.label ?? "Basic"} plan`}
                <Badge variant="secondary" className="font-normal">
                  Current plan
                </Badge>
              </CardTitle>
              <CardDescription>
                {isUsageLoading
                  ? "Fetching your usage…"
                  : usage
                    ? `Billed monthly · ${formatBillingPeriod(usage.billingPeriod)} usage period`
                    : ""}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold">
                {isUsageLoading || !usage
                  ? "—"
                  : formatCurrency(usage.planLimits.priceLKR)}
              </div>
              <div className="text-xs text-muted-foreground">per month</div>
              {!isUsageLoading && usage && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {usage.planLimits.commissionRatePercent}% commission
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <Separator />

            {isUsageLoading && (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading usage…
              </div>
            )}

            {isUsageError && !isUsageLoading && (
              <div className="flex items-center gap-2 py-6 text-sm text-red-600">
                <AlertTriangle className="size-4" />
                Couldn&apos;t load your usage. Try refreshing the page.
              </div>
            )}

            {!isUsageLoading &&
              !isUsageError &&
              usage &&
              Object.values(usage.metrics).map((metric) => {
                const limitText = metric.isUnlimited
                  ? `${metric.used.toLocaleString()} used · Unlimited`
                  : `${metric.used.toLocaleString()} / ${(metric.limit as number).toLocaleString()}`

                return (
                  <div key={metric.label} className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{metric.label}</span>
                      <span className="text-muted-foreground">{limitText}</span>
                    </div>
                    {!metric.isUnlimited && (
                      <Progress
                        value={metric.percentage}
                        className={metric.percentage >= 90 ? "[&>div]:bg-red-500" : ""}
                      />
                    )}
                  </div>
                )
              })}
          </CardContent>

          <CardFooter className="gap-2">
            <Button asChild>
              <Link href="/subscription">
                Upgrade plan
                <ArrowUpRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/subscription">Change plan</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Last payment method used */}
        <Card>
          <CardHeader>
            <CardTitle>Last payment</CardTitle>
            <CardDescription>Method used for your most recent invoice</CardDescription>
          </CardHeader>
          <CardContent>
            {isPaymentsLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </div>
            )}

            {!isPaymentsLoading && !mostRecentPayment && (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            )}

            {!isPaymentsLoading && mostRecentPayment && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                  <CreditCard className="size-4" />
                </div>
                <div className="flex-1 text-sm">
                  <div className="font-medium capitalize">
                    {formatMethodLabel(mostRecentPayment.payment_method)}
                  </div>
                  <div className="text-muted-foreground">
                    {formatDate(mostRecentPayment.created_at)} ·{" "}
                    {formatCurrency(mostRecentPayment.payment_amount)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice history */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Invoice history</CardTitle>
            <CardDescription>Your subscription payment history</CardDescription>
          </div>
          <Tabs
            value={methodFilter}
            onValueChange={(v) => setMethodFilter(v as MethodFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="card">Card</TabsTrigger>
              <TabsTrigger value="bank_transfer">Bank transfer</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPaymentsLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Loading invoices…
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {isPaymentsError && !isPaymentsLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-red-600">
                    Couldn&apos;t load your invoices.
                  </TableCell>
                </TableRow>
              )}

              {!isPaymentsLoading &&
                !isPaymentsError &&
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.reference}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invoice.createdAt)}
                    </TableCell>
                    <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {formatMethodLabel(invoice.method)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.receiptUrl ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          aria-label={`Download receipt for ${invoice.reference}`}
                        >
                          <a href={invoice.receiptUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="size-4" />
                          </a>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" disabled aria-label="No receipt available">
                          <Download className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

              {!isPaymentsLoading && !isPaymentsError && filteredInvoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No invoices match this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="mt-6 border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="text-base">Cancel subscription</CardTitle>
          <CardDescription>
            Your plan stays active until the end of the current billing period.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          {/* TODO: wire this up to your cancel-subscription endpoint */}
          <Button variant="destructive">Cancel subscription</Button>
        </CardFooter>
      </Card>
    </div>
  )
}