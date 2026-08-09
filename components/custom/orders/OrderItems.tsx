'use client';
import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { X, Send, Eye, PackageSearch, Loader2 } from "lucide-react";
import { formatCurrency, type OrderItemData } from "@/lib/api/orders";

// ---------- Item image ----------

function ItemImage({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
        <PackageSearch className="h-5 w-5 text-slate-300" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote vendor
    // images of unknown/varied hosts; a plain <img> avoids Next/Image
    // remote-pattern config here.
    <img
      src={url}
      alt={name}
      onError={() => setFailed(true)}
      className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover"
    />
  );
}

// ---------- Item card ----------
//
// Status -> icon mapping:
//  - "pending"                         -> grey X (opens the inline cancel-reason input)
//  - "cancelled"                       -> red Eye + tooltip showing cancellation_reason
//  - "confirmed" / "shipped" / "delivered" -> green Eye + tooltip ("Accepted" for confirmed,
//                                              the status name itself for shipped/delivered)

interface OrderItemCardProps {
  item: OrderItemData;
  onCancelItem?: (itemId: string, reason: string) => Promise<void> | void;
}

function OrderItemCard({ item, onCancelItem }: OrderItemCardProps) {
  const [inputOpen, setInputOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const subtotal = item.unitPrice * item.quantity;
  const statusLabel = item.status.charAt(0).toUpperCase() + item.status.slice(1);

  async function handleSubmit() {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onCancelItem?.(item.id, trimmed);
      setInputOpen(false);
      setDraft("");
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start gap-3">
        <ItemImage url={item.imageUrl} name={item.name} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            <span className="tabular-nums">
              {formatCurrency(item.unitPrice)} × {item.quantity}
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-mono text-[11px] lowercase tracking-wide text-slate-400">
              {item.sku || "no-sku"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-between self-stretch gap-2">
          {item.status === "cancelled" ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-red-500 transition hover:text-red-600"
                    aria-label="View cancellation reason"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-56 text-xs leading-snug">
                  {item.cancellationReason || "No reason given"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : item.status !== "pending" ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-emerald-500 transition hover:text-emerald-600"
                    aria-label={statusLabel}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {item.status === "confirmed" ? "Accepted" : statusLabel}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <button
              type="button"
              onClick={() => setInputOpen((v) => !v)}
              className="text-slate-300 transition hover:text-red-500"
              aria-label="Cancel this item"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <span className="whitespace-nowrap text-sm font-medium tabular-nums text-slate-900">
            {formatCurrency(subtotal)}
          </span>
        </div>
      </div>

      {inputOpen && item.status === "pending" && (
        <div className="mt-2.5 border-t border-dashed border-slate-200 pt-2.5">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Reason for cancelling this item"
              className="h-8 flex-1 rounded-full text-xs"
              disabled={isSubmitting}
            />
            <Button
              type="button"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              onClick={handleSubmit}
              disabled={isSubmitting}
              aria-label="Send cancellation reason"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          {submitError && <p className="mt-1.5 text-xs text-red-600">{submitError}</p>}
        </div>
      )}
    </div>
  );
}

function OrderItemCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
      <Skeleton className="h-16 w-16 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

interface OrderItemsProps {
  items: OrderItemData[];
  isLoading?: boolean;
  onCancelItem?: (itemId: string, reason: string) => Promise<void> | void;
}

export default function OrderItems({ items, isLoading, onCancelItem }: OrderItemsProps) {
  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <OrderItemCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
        No items on this order.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <OrderItemCard key={item.id} item={item} onCancelItem={onCancelItem} />
      ))}
    </div>
  );
}