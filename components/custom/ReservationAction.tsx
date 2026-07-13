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
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import type { ReservationWithRelations } from "@/lib/api/reservations";
import { useAcceptReservation, useRejectReservation } from "@/hooks/use-reservations";

type Mode = "choice" | "accept" | "reject";

interface ReservationActionProps {
  reservation: ReservationWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Skip the choice screen and open straight into this form. Omit for the normal choice screen. */
  initialMode?: "accept" | "reject";
}

export default function ReservationAction({
  reservation,
  open,
  onOpenChange,
  initialMode,
}: ReservationActionProps) {
  const [mode, setMode] = useState<Mode>("choice");

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [finalAmount, setFinalAmount] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const acceptMutation = useAcceptReservation();
  const rejectMutation = useRejectReservation();

  // Reset to the choice screen and prefill sensible defaults every time
  // the dialog opens for a (possibly different) reservation.
  useEffect(() => {
    if (open && reservation) {
      setMode(initialMode ?? "choice");
      setStartTime(reservation.start_time?.slice(0, 5) ?? "");
      setEndTime(reservation.end_time?.slice(0, 5) ?? "");
      setFinalAmount(
        reservation.total_amount != null ? String(reservation.total_amount) : ""
      );
      setReason("");
      setFormError(null);
    }
  }, [open, reservation, initialMode]);

  if (!reservation) return null;

  async function handleConfirmAccept() {
    setFormError(null);

    if (!startTime || !endTime) {
      setFormError("Start time and end time are required.");
      return;
    }
    if (endTime <= startTime) {
      setFormError("End time must be after start time.");
      return;
    }
    const amount = Number(finalAmount);
    if (!finalAmount || Number.isNaN(amount) || amount <= 0) {
      setFormError("Enter a valid final total amount.");
      return;
    }

    try {
      await acceptMutation.mutateAsync({
        id: reservation!.id,
        vendorStartTime: startTime,
        vendorEndTime: endTime,
        finalVendorTotalAmount: amount,
      });
      onOpenChange(false);
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function handleConfirmReject() {
    setFormError(null);

    if (!reason.trim()) {
      setFormError("Please provide a cancellation reason.");
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        id: reservation!.id,
        cancellationReason: reason.trim(),
      });
      onOpenChange(false);
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {mode === "choice" && (
          <>
            <DialogHeader>
              <DialogTitle>Reservation action</DialogTitle>
              <DialogDescription>
                Accept this reservation to confirm the schedule, or cancel it with a
                reason.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 py-2">
              <button
                type="button"
                onClick={() => setMode("accept")}
                className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-center transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <span className="text-sm font-medium text-slate-900">Accept</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("reject")}
                className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-center transition hover:border-red-300 hover:bg-red-50"
              >
                <XCircle className="h-6 w-6 text-red-600" />
                <span className="text-sm font-medium text-slate-900">Cancel</span>
              </button>
            </div>
          </>
        )}

        {mode === "reject" && (
          <>
            <DialogHeader>
              <button
                type="button"
                onClick={() => setMode("choice")}
                className="mb-1 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
              <DialogTitle className="text-red-600">Reject reservation</DialogTitle>
              <DialogDescription>
                This reservation will be marked as cancelled. Let the customer know
                why.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              <Label htmlFor="cancellation-reason">Cancellation reason</Label>
              <Textarea
                id="cancellation-reason"
                placeholder="e.g. Vendor unavailable on the requested date"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setMode("choice")}
                disabled={rejectMutation.isPending}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmReject}
                disabled={rejectMutation.isPending}
                className="gap-1.5"
              >
                {rejectMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Confirm cancellation
              </Button>
            </DialogFooter>
          </>
        )}

        {mode === "accept" && (
          <>
            <DialogHeader>
              <button
                type="button"
                onClick={() => setMode("choice")}
                className="mb-1 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
              <DialogTitle className="text-emerald-600">Accept reservation</DialogTitle>
              <DialogDescription>
                Confirm the schedule and final amount for this reservation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start-time">Start time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end-time">End time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="final-amount">Final total amount (LKR)</Label>
                <Input
                  id="final-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={finalAmount}
                  onChange={(e) => setFinalAmount(e.target.value)}
                />
              </div>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setMode("choice")}
                disabled={acceptMutation.isPending}
              >
                Back
              </Button>
              <Button
                onClick={handleConfirmAccept}
                disabled={acceptMutation.isPending}
                className="gap-1.5"
              >
                {acceptMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Confirm acceptance
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
