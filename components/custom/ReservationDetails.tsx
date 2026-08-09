'use client';
import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User,
  CalendarDays,
  Clock,
  Users as UsersIcon,
  CreditCard,
  Wallet,
  Wrench,
  Tag,
} from "lucide-react";
import type { ReservationWithRelations } from "@/lib/api/reservations";

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
  pending: "Still pending",
  accepted: "Accepted",
  cancelled: "Cancelled",
};

interface ReservationDetailsProps {
  reservation: ReservationWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the footer "Action" button is clicked — wire this to open ReservationAction. */
  onAction: () => void;
}

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="flex shrink-0 items-center gap-1.5 text-sm text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        {label}
      </span>
      <span className="text-sm font-medium text-slate-900 sm:text-right">
        {value ?? "—"}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </p>
  );
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(t?: string | null) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

export default function ReservationDetails({
  reservation,
  open,
  onOpenChange,
  onAction,
}: ReservationDetailsProps) {
  if (!reservation) return null;

  const r = reservation;
  const customerName =
    [r.customer?.first_name, r.customer?.last_name].filter(Boolean).join(" ") ||
    "Unknown customer";

  const hasVendorSchedule = Boolean(r.vendor_start_time || r.vendor_end_time);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="text-lg">
            RSV-{r.id.slice(0, 8).toUpperCase()}
          </SheetTitle>
          <SheetDescription>Created {formatDate(r.created_at)}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 divide-y divide-slate-100 px-1">
          <div className="py-3">
            <SectionLabel>Service</SectionLabel>
            <div className="mb-3 flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                {r.service?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.service.image_url}
                    alt={r.service.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Wrench className="h-5 w-5 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {r.service?.name ?? "Unknown service"}
                </p>
                <p className="text-xs text-slate-500">{r.service?.category}</p>
              </div>
            </div>
            <DetailRow
              icon={Tag}
              label="Base price"
              value={
                r.service
                  ? `LKR ${r.service.price.toFixed(2)}${
                      r.service.price_type === "hourly" ? " / hr" : ""
                    }`
                  : undefined
              }
            />
            <DetailRow icon={UsersIcon} label="People count" value={r.people_count} />
          </div>

          <div className="py-3">
            <SectionLabel>Schedule</SectionLabel>
            <DetailRow
              icon={CalendarDays}
              label="Requested date"
              value={formatDate(r.reservation_date)}
            />
            <DetailRow
              icon={Clock}
              label="Requested time"
              value={`${formatTime(r.start_time)} - ${formatTime(r.end_time)}`}
            />
            {hasVendorSchedule && (
              <DetailRow
                icon={Clock}
                label="Confirmed time"
                value={`${formatTime(r.vendor_start_time)} - ${formatTime(r.vendor_end_time)}`}
              />
            )}
          </div>

          <div className="py-3">
            <SectionLabel>Customer</SectionLabel>
            <DetailRow icon={User} label="Full name" value={customerName} />
            <p className="pt-1.5 text-xs text-slate-400">
              Contact details are withheld per company policy.
            </p>
          </div>

          <div className="py-3">
            <SectionLabel>Payment</SectionLabel>
            <DetailRow
              icon={Wallet}
              label="Payment method"
              value={r.payment_method === "cash" ? "Cash" : "Card"}
            />
            {r.payment_reference && (
              <DetailRow
                icon={CreditCard}
                label="Payment reference"
                value={r.payment_reference}
              />
            )}
            <DetailRow label="Total amount" value={`LKR ${r.total_amount.toFixed(2)}`} />
            {r.final_vendor_total_amount != null && (
              <DetailRow
                label="Final vendor total"
                value={`LKR ${r.final_vendor_total_amount.toFixed(2)}`}
              />
            )}
          </div>

          {r.status === "cancelled" && r.cancellation_reason && (
            <div className="py-3">
              <SectionLabel>Cancellation reason</SectionLabel>
              <p className="text-sm text-slate-700">{r.cancellation_reason}</p>
            </div>
          )}
        </div>

        <SheetFooter className="mt-2 flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[r.status]}`} />
            <Badge variant="outline" className={`font-medium ${STATUS_STYLES[r.status]}`}>
              {STATUS_LABEL[r.status] ?? r.status}
            </Badge>
          </div>

          {r.status === "pending" && (
            <Button onClick={onAction}>Action</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}