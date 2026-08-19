'use client';
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  SlidersHorizontal,
  Eye,
  CalendarDays,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Package,
  AlertCircle,
  Zap,
  Infinity as InfinityIcon,
} from "lucide-react";
import {
  useOrders,
  useOrderDetail,
  useCancelOrderItem,
  useAcceptOrder,
  useVendorOrderCredits,
} from "@/hooks/use-orders";
import { useVendor } from "@/hooks/use-user";
import OrderDetails from "@/components/custom/orders/OrderDetails";
import { formatCurrency, type OrderStatus } from "@/lib/api/orders";

const STATUS_CONFIG: Record<OrderStatus, { label: string; badgeClass: string; dotClass: string }> = {
  pending: { label: "Pending", badgeClass: "bg-amber-50 text-amber-700 border-amber-200", dotClass: "bg-amber-500" },
  confirmed: { label: "Confirmed", badgeClass: "bg-blue-50 text-blue-700 border-blue-200", dotClass: "bg-blue-500" },
  processing: { label: "Processing", badgeClass: "bg-violet-50 text-violet-700 border-violet-200", dotClass: "bg-violet-500" },
  shipped: { label: "Shipped", badgeClass: "bg-sky-50 text-sky-700 border-sky-200", dotClass: "bg-sky-500" },
  delivered: { label: "Delivered", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", dotClass: "bg-emerald-500" },
  cancelled: { label: "Cancelled", badgeClass: "bg-red-50 text-red-700 border-red-200", dotClass: "bg-red-500" },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={`gap-1.5 font-medium ${config.badgeClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      {config.label}
    </Badge>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const PAGE_SIZE = 8;
const TABLE_COLUMN_COUNT = 7;

function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push("…");
    result.push(p);
  });
  return result;
}

function SkeletonRow() {
  return (
    <TableRow>
      {Array.from({ length: TABLE_COLUMN_COUNT }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full max-w-[110px]" />
        </TableCell>
      ))}
    </TableRow>
  );
}

function PlanCreditBadge({
  plan,
  remaining,
  isLoading,
}: {
  plan?: string;
  remaining?: number | null;
  isLoading: boolean;
}) {
  if (isLoading || !plan) {
    return <Skeleton className="h-6 w-36 rounded-full" />;
  }

  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const isUnlimited = remaining === null || remaining === undefined;
  const isLow = !isUnlimited && (remaining ?? 0) <= 2;

  return (
    <Badge
      variant="outline"
      className={`gap-1.5 rounded-full px-3 py-1 font-medium ${
        isLow
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {isUnlimited ? <InfinityIcon className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
      {planLabel}
      <span className="text-slate-300">|</span>
      {isUnlimited ? "Unlimited orders" : `${remaining} credit${remaining === 1 ? "" : "s"} available`}
    </Badge>
  );
}

interface OrderPageProps {
  vendorId?: string | null;
}

export default function OrderPage({ vendorId = null }: OrderPageProps) {
  const searchParams = useSearchParams();
  const { data: currentVendor, isLoading: isVendorLoading } = useVendor();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { rows, isLoading, isError, error, refetch } = useOrders({
    search: query,
    status: statusFilter,
    vendorId: isVendorLoading ? null : currentVendor?.id ?? vendorId,
  });

  const resolvedVendorId = currentVendor?.id ?? vendorId;
  const { data: credits, isLoading: creditsLoading } = useVendorOrderCredits(resolvedVendorId);
  const { data: selectedOrder, isLoading: detailLoading } = useOrderDetail(detailsOpen ? selectedId : null);
  const cancelItemMutation = useCancelOrderItem();
  const acceptOrderMutation = useAcceptOrder();

  useEffect(() => {
    const payhereOrderId = searchParams.get("order_id");
    if (!payhereOrderId || !payhereOrderId.startsWith("ORDPAY_")) return;

    const parts = payhereOrderId.split("_");
    if (parts.length < 3) return;

    const orderId = parts[1];

    const confirmOrder = async () => {
      try {
        const response = await fetch(`/api/payment/test-notify-order?order_id=${orderId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const result = await response.json();

        if (response.ok && result.success) {
          toast.success("Order confirmed and payment recorded");
          refetch();
        } else {
          toast.info("Payment confirmed. Please refresh to see updated status.");
        }
      } catch (err) {
        console.error("[PayHere] Error confirming order:", err);
        toast.info("Payment confirmed. Refresh page to see changes.");
      }
    };

    confirmOrder();
  }, [searchParams, refetch]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage]
  );

  function goToPage(p: number) {
    setPage(Math.min(Math.max(p, 1), totalPages));
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handleStatusChange(value: OrderStatus | "all") {
    setStatusFilter(value);
    setPage(1);
  }

  function handleReset() {
    setQuery("");
    setStatusFilter("all");
    setPage(1);
  }

  const hasActiveFilters = query.trim() !== "" || statusFilter !== "all";

  function openDetails(id: string) {
    setSelectedId(id);
    setDetailsOpen(true);
  }

  async function handleCancelItem(itemId: string, reason: string) {
    await cancelItemMutation.mutateAsync({ itemId, reason });
  }

  async function handleAccept(orderId: string, trackingId: string) {
    await acceptOrderMutation.mutateAsync({ id: orderId, trackingId });
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-20">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orders</h1>
            <p className="text-sm text-slate-500">
              Track, fulfil, and manage your customer orders.
            </p>
          </div>

          <PlanCreditBadge
            plan={credits?.plan}
            remaining={credits?.remaining}
            isLoading={creditsLoading}
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by order no or customer"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => handleStatusChange(v as OrderStatus | "all")}>
              <SelectTrigger className="w-[170px] gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-slate-600"
              onClick={handleReset}
              disabled={!hasActiveFilters}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="max-h-[560px] overflow-auto rounded-md">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="whitespace-nowrap">Order ID</TableHead>
                    <TableHead className="whitespace-nowrap">Order Date</TableHead>
                    <TableHead className="whitespace-nowrap">Customer</TableHead>
                    <TableHead className="whitespace-nowrap">Total Price</TableHead>
                    <TableHead className="whitespace-nowrap">Items</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="w-[60px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

                  {!isLoading && isError && (
                    <TableRow>
                      <TableCell colSpan={TABLE_COLUMN_COUNT} className="py-14 text-center">
                        <div className="flex flex-col items-center gap-2 text-sm text-red-500">
                          <AlertCircle className="h-5 w-5" />
                          <span>{(error as Error)?.message ?? "Failed to load orders."}</span>
                          <Button variant="outline" size="sm" className="mt-1" onClick={() => refetch()}>
                            Try again
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading && !isError && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={TABLE_COLUMN_COUNT} className="py-14 text-center">
                        <div className="flex flex-col items-center gap-2 text-sm text-slate-400">
                          <Inbox className="h-5 w-5" />
                          <span>
                            {hasActiveFilters ? "No orders match your filters." : "No orders yet."}
                          </span>
                          {hasActiveFilters && (
                            <Button variant="outline" size="sm" className="mt-1" onClick={handleReset}>
                              Clear filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading && !isError && paginatedRows.map((r) => {
                    const itemCount = r.itemCount ?? 0;

                    return (
                      <TableRow key={r.id} className="hover:bg-slate-50/60">
                        <TableCell className="font-mono text-xs font-medium text-slate-900">
                          {r.orderNo}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                            <span className="tabular-nums">{formatDate(r.orderDate)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700">{r.customerName}</TableCell>
                        <TableCell className="font-medium tabular-nums text-slate-900">
                          {formatCurrency(r.totalAmount)}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-slate-400" />
                            {itemCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openDetails(r.id)}
                          >
                            <Eye className="h-4 w-4 text-slate-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-3">
              <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing{" "}
                  <span className="font-medium text-slate-700">
                    {rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
                  </span>
                  {"–"}
                  <span className="font-medium text-slate-700">
                    {Math.min(currentPage * PAGE_SIZE, rows.length)}
                  </span>{" "}
                  of <span className="font-medium text-slate-700">{rows.length}</span> order
                  {rows.length === 1 ? "" : "s"}
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 px-2.5"
                    disabled={currentPage === 1}
                    onClick={() => goToPage(currentPage - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </Button>

                  {getPageNumbers(currentPage, totalPages).map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="px-1.5 text-slate-400">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === currentPage ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => goToPage(p)}
                      >
                        {p}
                      </Button>
                    )
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 px-2.5"
                    disabled={currentPage === totalPages}
                    onClick={() => goToPage(currentPage + 1)}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <OrderDetails
        order={selectedOrder ?? null}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        isLoading={detailLoading}
        onCancelItem={handleCancelItem}
        onAccept={handleAccept}
      />
    </div>
  );
}