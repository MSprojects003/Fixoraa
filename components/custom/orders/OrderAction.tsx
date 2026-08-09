'use client';
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Truck } from "lucide-react";
import type { OrderDetail } from "@/lib/api/orders";

// Single-purpose now: cancellation moved to the per-item flow on each
// item card, so the only order-level action left is Accept.
interface OrderActionProps {
  order: OrderDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept?: (orderId: string, trackingId: string) => Promise<void> | void;
}

export default function OrderAction({ order, open, onOpenChange, onAccept }: OrderActionProps) {
  const [trackingId, setTrackingId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && order) {
      setTrackingId(order.trackId ?? "");
      setFormError(null);
      setIsSubmitting(false);
    }
  }, [open, order]);

  if (!order) return null;

  async function handleConfirm() {
    setFormError(null);

    if (!trackingId.trim()) {
      setFormError("Enter a tracking ID.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAccept?.(order!.id, trackingId.trim());
      onOpenChange(false);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-emerald-600">Accept order</DialogTitle>
          <DialogDescription>
            Add a tracking ID to confirm every remaining item and proceed to the commission
            payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="track-id" className="flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-slate-400" />
            Tracking ID
          </Label>
          <Input
            id="track-id"
            placeholder="e.g. LK123456789"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirm &amp; pay commission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}