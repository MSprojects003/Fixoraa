'use client';
import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Globe, CircleDot } from "lucide-react";
import OrderItems from "@/components/custom/orders/OrderItems";
import OrderAction from "@/components/custom/orders/OrderAction";
import { fetchCustomerById, type CustomerDetails } from "@/lib/api/customer";
import {
  formatOrderNo,
  formatCurrency,
  type OrderDetail,
  type OrderStatus,
} from "@/lib/api/orders";

const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  pending: { label: "Pending", badgeClass: "bg-amber-50 text-amber-700 border-amber-200", dotClass: "bg-amber-500" },
  confirmed: { label: "Confirmed", badgeClass: "bg-blue-50 text-blue-700 border-blue-200", dotClass: "bg-blue-500" },
  processing: { label: "Processing", badgeClass: "bg-violet-50 text-violet-700 border-violet-200", dotClass: "bg-violet-500" },
  shipped: { label: "Shipped", badgeClass: "bg-sky-50 text-sky-700 border-sky-200", dotClass: "bg-sky-500" },
  delivered: { label: "Delivered", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", dotClass: "bg-emerald-500" },
  cancelled: { label: "Cancelled", badgeClass: "bg-red-50 text-red-700 border-red-200", dotClass: "bg-red-500" },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = ORDER_STATUS_CONFIG[status];
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{children}</span>
    </div>
  );
}

function DetailRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-3.5 w-28" />
    </div>
  );
}

function DeliveryAddressValue({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <>--</>;

  const normalized = {
    formatted: typeof data.formatted === "string" ? data.formatted : null,
    street: typeof data.street === "string" ? data.street : typeof data.address_line1 === "string" ? data.address_line1 : null,
    addressLine2: typeof data.address_line2 === "string" ? data.address_line2 : null,
    city: typeof data.city === "string" ? data.city : typeof (data.properties as any)?.city === "string" ? (data.properties as any).city : null,
    postcode: typeof data.postcode === "string" ? data.postcode : null,
    name: typeof (data.properties as any)?.name === "string" ? (data.properties as any).name : null,
  };

  const parts = [normalized.formatted, normalized.name, normalized.street, normalized.addressLine2, normalized.city, normalized.postcode]
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");

  return parts.length > 0 ? <>{parts.join(", ")}</> : <>--</>;
}

interface OrderDetailsProps {
  order: OrderDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
  onCancelItem?: (itemId: string, reason: string) => Promise<void> | void;
  onAccept?: (orderId: string, trackingId: string) => Promise<void> | void;
}

export default function OrderDetails({
  order,
  open,
  onOpenChange,
  isLoading,
  onCancelItem,
  onAccept,
}: OrderDetailsProps) {
  const [actionOpen, setActionOpen] = useState(false);

  const customerId = order?.customer_id || order?.customer?.id;

  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);

  useEffect(() => {
    async function loadCustomer() {
      if (!customerId) {
        setCustomer(null);
        return;
      }

      setCustomerLoading(true);
      const cust = await fetchCustomerById(customerId);
      setCustomer(cust);
      setCustomerLoading(false);
    }

    if (open && customerId) {
      loadCustomer();
    }
  }, [customerId, open]);

  const showCustomerSkeleton = isLoading || !order || customerLoading;

  const initials = React.useMemo(() => {
    if (!customer?.fullName) return "UC";
    return customer.fullName
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [customer?.fullName]);

  const canAct = order &&
    order.status !== "cancelled" &&
    order.status !== "delivered" &&
    order.totalAmount > 0 &&
    order.items.some((it: any) => it.status !== "cancelled");

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-slate-100 px-6 py-5">
            <SheetTitle className="font-mono text-lg tracking-tight">
              {isLoading || !order ? <Skeleton className="h-6 w-40" /> : formatOrderNo(order.id)}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {/* Order details */}
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Order details
              </h3>
              <Separator className="mb-1" />
              {isLoading || !order ? (
                <div className="divide-y divide-slate-100">
                  {Array.from({ length: 7 }).map((_, i) => <DetailRowSkeleton key={i} />)}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  <DetailRow label="Vendor">{order.vendor?.vendorName ?? "--"}</DetailRow>
                  <DetailRow label="Created at">{formatDate(order.createdAt)}</DetailRow>
                  <DetailRow label="Total amount">
                    <span className="tabular-nums">{formatCurrency(order.totalAmount)}</span>
                  </DetailRow>
                  <DetailRow label="Payment method">
                    <span className="capitalize">{order.paymentMethod}</span>
                  </DetailRow>
                  <DetailRow label="Shipping address">{order.shippingAddress ?? "--"}</DetailRow>
                  <DetailRow label="Status">
                    <StatusBadge status={order.status} />
                  </DetailRow>
                  <DetailRow label="Track ID">
                    <span className="font-mono text-xs">{order.trackId ?? "--"}</span>
                  </DetailRow>
                </div>
              )}
            </section>

            {/* Customer details */}
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Customer details
              </h3>
              <Separator className="mb-2" />

              {showCustomerSkeleton ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="divide-y divide-slate-100">
                    {Array.from({ length: 5 }).map((_, i) => <DetailRowSkeleton key={i} />)}
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage 
                        src={customer?.profileImage ?? undefined} 
                        alt={customer?.fullName || "Customer"}
                      />
                      <AvatarFallback className="bg-slate-100 text-xs font-medium text-slate-600">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {customer?.fullName || "Unknown customer"}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-slate-400">
                        <CircleDot 
                          className={`h-2.5 w-2.5 ${customer?.isActive ? "text-emerald-500" : "text-slate-300"}`} 
                        />
                        {customer?.isActive ? "Active customer" : "Inactive"}
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    <DetailRow label="Email">{customer?.email ?? "--"}</DetailRow>
                    <DetailRow label="Address">{customer?.address ?? "--"}</DetailRow>
                    <DetailRow label="City">{customer?.city ?? "--"}</DetailRow>
                    <DetailRow label="Phone">{customer?.phone ?? "--"}</DetailRow>
                    <DetailRow label="Delivery address">
                      <DeliveryAddressValue data={customer?.deliveryAddress ?? null} />
                    </DetailRow>
                    <DetailRow label="Preferred language">
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-slate-400" />
                        {customer?.preferredLanguage?.toUpperCase() ?? "--"}
                      </span>
                    </DetailRow>
                    <DetailRow label="Member since">
                      {formatDate(customer?.createdAt ?? order?.createdAt ?? "")}
                    </DetailRow>
                  </div>
                </>
              )}
            </section>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Items
              </h3>
              <Separator className="mb-2" />
              <OrderItems
                items={order?.items ?? []}
                isLoading={isLoading || !order}
                onCancelItem={onCancelItem}
              />
            </section>
          </div>

          {canAct && (
            <SheetFooter className="border-t border-slate-100 px-6 py-4">
              <Button className="w-full gap-1.5" onClick={() => setActionOpen(true)}>
                <CheckCircle2 className="h-4 w-4" />
                Accept
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <OrderAction
        order={order}
        open={actionOpen}
        onOpenChange={setActionOpen}
        onAccept={onAccept}
      />
    </>
  );
}