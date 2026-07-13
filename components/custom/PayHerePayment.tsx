"use client";

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { createPayHerePaymentData, PAYHERE_BASE_URL, PayHerePaymentData } from '@/lib/payhere';

interface PayHerePaymentProps {
  planId: string;
  planName: string;
  amount: string;
  vendorId: string;
  userId: string;
  userData: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
  };
  onSuccess?: (response: any) => void;
  onCancel?: () => void;
  onError?: (error: any) => void;
  isSubmitting?: boolean;
}

export function PayHerePayment({
  planId,
  planName,
  amount,
  vendorId,
  userId,
  userData,
  onCancel,
  onError,
  isSubmitting = false,
}: PayHerePaymentProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    if (!formRef.current) return;
    if (!vendorId || !userId) {
      onError?.('Vendor or user not loaded yet. Please wait.');
      return;
    }
    setIsProcessing(true);

    try {
      const returnUrl = `${window.location.origin}/payment/success`;
      const cancelUrl = `${window.location.origin}/payment/cancel`;
      const notifyUrl = `${window.location.origin}/api/payment/notify`;

      const paymentData: PayHerePaymentData = await createPayHerePaymentData(
        planId,
        amount,
        vendorId,
        userId,
        userData,
        returnUrl,
        cancelUrl,
        notifyUrl
      );

      const form = formRef.current;
      form.innerHTML = '';
      Object.entries(paymentData).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
      });

      form.submit();
    } catch (error) {
      console.error('Payment error:', error);
      onError?.(error);
      setIsProcessing(false);
    }
  };

  const busy = isSubmitting || isProcessing;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1">
        <p className="text-sm text-blue-800 font-medium">
          You will be redirected to PayHere to complete your payment securely.
        </p>
        <p className="text-sm text-blue-700">Plan: <strong>{planName}</strong></p>
        <p className="text-sm text-blue-700">
          Amount: <strong>{parseFloat(amount).toFixed(2)} LKR</strong>
        </p>
      </div>

      <form ref={formRef} action={PAYHERE_BASE_URL} method="post" className="hidden" />

      <div className="space-y-3">
        <Button
          type="button"
          onClick={handlePayment}
          disabled={busy || !vendorId || !userId}
          className="w-full bg-black hover:bg-gray-800 text-white h-11"
        >
          {busy ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
          ) : (
            `Pay ${parseFloat(amount).toFixed(2)} LKR via PayHere`
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={busy}
          className="w-full h-11"
        >
          Cancel
        </Button>
      </div>
      <p className="text-xs text-center text-gray-400">
        Secured by PayHere. Your payment information is protected.
      </p>
    </div>
  );
}