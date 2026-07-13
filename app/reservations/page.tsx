'use client';
import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  SlidersHorizontal,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarDays,
  RotateCcw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useReservations } from "@/hooks/use-reservations";
import type { ReservationStatus } from "@/lib/api/reservations";
import ReservationDetails from "@/components/custom/ReservationDetails";
import ReservationAction from "@/components/custom/ReservationAction";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-500",
  accepted: "bg-emerald-500",
  cancelled: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  cancelled: "Cancelled",
};

// Static badge — used once a reservation is no longer pending, so it's
// no longer editable from the table.
function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 font-medium ${STATUS_STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

// Clickable badge — only rendered while status is "pending". Opens a
// small dropdown with Accept / Cancel, each jumping straight into the
// matching ReservationAction form.
function EditableStatusBadge({
  status,
  onAccept,
  onCancel,
}: {
  status: string;
  onAccept: () => void;
  onCancel: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="group inline-flex items-center gap-1">
          <Badge
            variant="outline"
            className={`gap-1.5 font-medium transition group-hover:ring-1 group-hover:ring-slate-300 ${STATUS_STYLES[status]}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
            {STATUS_LABEL[status] ?? status}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        <DropdownMenuItem
          className="gap-2 text-emerald-600 focus:text-emerald-600"
          onClick={onAccept}
        >
          <CheckCircle2 className="h-4 w-4" /> Accept
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-red-600 focus:text-red-600"
          onClick={onCancel}
        >
          <XCircle className="h-4 w-4" /> Cancel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PAGE_SIZE = 8;

// Returns page numbers with "…" gaps, e.g. [1, "…", 4, 5, 6, "…", 12]
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ReservationPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">("all");
  const [page, setPage] = useState(1);

  const { reservations, rows, isLoading, isError, error, refetch } = useReservations({
    search: query,
    status: statusFilter,
  });

  // Handle PayHere callback when user is redirected back with order_id
  useEffect(() => {
    const orderId = searchParams.get("order_id");
    if (!orderId) return;

    // Extract reservation ID from order_id format: RSVPAY_{reservationId}_{timestamp}
    const parts = orderId.split("_");
    if (parts.length < 3 || parts[0] !== "RSVPAY") {
      console.error("[PayHere] Invalid order_id format:", orderId);
      return;
    }

    const reservationId = parts[1];
    console.log("[PayHere] Processing callback for reservation:", reservationId);

    // Retrieve stored payment data from localStorage
    const storedPaymentStr = localStorage.getItem("payhere_pending_payment");
    const storedPayment = storedPaymentStr ? JSON.parse(storedPaymentStr) : null;
    console.log("[PayHere] Retrieved stored payment data:", storedPayment);

    // Call test endpoint to update reservation status to accepted and insert payment record
    const updateReservation = async () => {
      try {
        console.log("[PayHere] Sending update request with reservation:", reservationId);
        const response = await fetch(`/api/payment/test-notify?reservation_id=${reservationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentData: storedPayment,
          }),
        });

        console.log("[PayHere] Response status:", response.status);
        const result = await response.json();
        console.log("[PayHere] Response body:", result);

        if (response.ok && result.success) {
          console.log("[PayHere] Reservation updated successfully:", result);
          toast.success("Reservation accepted and payment recorded");
          // Clear stored payment data
          localStorage.removeItem("payhere_pending_payment");
          // Refresh reservations to show updated status
          refetch();
        } else {
          console.error("[PayHere] Failed to update reservation. Status:", response.status, "Result:", result);
          toast.info("Payment confirmed. Please refresh to see updated status.");
        }
      } catch (error) {
        console.error("[PayHere] Error updating reservation:", error);
        toast.info("Payment confirmed. Refresh page to see changes.");
      }
    };

    updateReservation();
  }, [searchParams, refetch, toast]);

  // Which reservation the Sheet/Dialog are currently pointed at, plus
  // whether the action dialog should skip straight to accept/reject.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionInitialMode, setActionInitialMode] = useState<"accept" | "reject" | undefined>();

  const selectedReservation = reservations.find((r) => r.id === selectedId) ?? null;

  function openDetails(id: string) {
    setSelectedId(id);
    setDetailsOpen(true);
  }

  function openAction(id: string, mode?: "accept" | "reject") {
    setSelectedId(id);
    setActionInitialMode(mode);
    setActionOpen(true);
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = rows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function goToPage(p: number) {
    setPage(Math.min(Math.max(p, 1), totalPages));
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handleStatusChange(value: ReservationStatus | "all") {
    setStatusFilter(value);
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-20">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Service Reservations
          </h1>
          <p className="text-sm text-slate-500">
            Review, filter, and manage customer reservation requests.
          </p>
        </div>

        {/* Filters + Search — no card, no border */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by reservation no, customer, or service"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => handleStatusChange(v as ReservationStatus | "all")}
            >
              <SelectTrigger className="w-[160px] gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-slate-600"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
                setPage(1);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>

        {/* Table only, with border + scroll */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="max-h-[560px] overflow-auto rounded-md">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="whitespace-nowrap">Reservation No.</TableHead>
                    <TableHead className="whitespace-nowrap">Customer</TableHead>
                    <TableHead className="whitespace-nowrap">Service</TableHead>
                    <TableHead className="whitespace-nowrap">Created On</TableHead>
                    <TableHead className="whitespace-nowrap">Requested Date</TableHead>
                    <TableHead className="whitespace-nowrap">Time Range</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="w-[60px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-sm text-slate-400">
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                        Loading reservations…
                      </TableCell>
                    </TableRow>
                  )}

                  {isError && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-sm text-red-500">
                        {(error as Error)?.message ?? "Failed to load reservations."}
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading && !isError && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-sm text-slate-400">
                        No reservations match your filters.
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading &&
                    !isError &&
                    paginatedRows.map((r) => (
                      <TableRow key={r.id} className="hover:bg-slate-50/60">
                        <TableCell className="font-medium text-slate-900">
                          {r.reservationNo}
                        </TableCell>
                        <TableCell className="text-slate-700">{r.customerName}</TableCell>
                        <TableCell className="text-slate-700">{r.serviceName}</TableCell>
                        <TableCell className="text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                            {formatDate(r.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {formatDate(r.requestedDate)}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {r.timeRange}
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.status === "pending" ? (
                            <EditableStatusBadge
                              status={r.status}
                              onAccept={() => openAction(r.id, "accept")}
                              onCancel={() => openAction(r.id, "reject")}
                            />
                          ) : (
                            <StatusBadge status={r.status} />
                          )}
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
                    ))}
                </TableBody>
              </Table>
            </div>

          {/* Pagination bar inside card */}
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
            of <span className="font-medium text-slate-700">{rows.length}</span> reservation
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
                <span key={`ellipsis-${i}`} className="px-1.5 text-slate-400">
                  …
                </span>
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
        </CardContent>
      </Card>
      </div>

      {/* Details sheet — opened by the Eye action */}
      <ReservationDetails
        reservation={selectedReservation}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onAction={() => openAction(selectedReservation!.id)}
      />

      {/* Accept/Cancel dialog — opened either from the status dropdown
          (with initialMode preset) or from the sheet's Action button
          (which opens on the choice screen). */}
      <ReservationAction
        reservation={selectedReservation}
        open={actionOpen}
        onOpenChange={setActionOpen}
        initialMode={actionInitialMode}
      />
    </div>
  );
}
