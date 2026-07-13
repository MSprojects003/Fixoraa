"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { activateSubscription, PlanType } from "@/lib/api/subscription";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [planType, setPlanType] = useState('');

  useEffect(() => {
    const activate = async () => {
      const supabase = createClient();

      // PayHere sends these as query params on return_url
      const orderId = searchParams.get('order_id') || '';
      const paymentId = searchParams.get('payment_id') || '';

      // Decode plan from order ID  e.g. SUB-pro-1234567890
      const parts = orderId.split('-');
      const plan = (['basic', 'pro', 'premium'].includes(parts[1])
        ? parts[1]
        : 'basic') as PlanType;

      setPlanType(plan);

      // Get current user + vendor
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMsg('Not logged in.');
        setStatus('error');
        return;
      }

      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!vendor) {
        setErrorMsg('Vendor not found.');
        setStatus('error');
        return;
      }

      const result = await activateSubscription({
        vendorId: vendor.id,
        userId: user.id,
        planType: plan,
        payhereOrderId: orderId || `SUB-${plan}-${Date.now()}`,
        payherePaymentId: paymentId || undefined,
        currency: 'LKR',
      });

      if (result.success) {
        setStatus('success');
      } else {
        setErrorMsg(result.error || 'Activation failed.');
        setStatus('error');
      }
    };

    activate();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center space-y-5">

        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto" />
            <h1 className="text-xl font-semibold text-gray-900">Activating your subscription...</h1>
            <p className="text-sm text-gray-500">Please wait, do not close this page.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-semibold text-gray-900">Payment successful!</h1>
            <p className="text-sm text-gray-500">
              Your <strong className="text-gray-800 capitalize">{planType}</strong> subscription is now active.
            </p>
            <Button
              onClick={() => router.push('/')}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white h-11"
            >
              Go to dashboard
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h1 className="text-xl font-semibold text-gray-900">Activation failed</h1>
            <p className="text-sm text-red-500">{errorMsg}</p>
            <p className="text-xs text-gray-400">
              Your payment may have gone through. Please contact support with your order ID.
            </p>
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full h-11"
            >
              Go to dashboard
            </Button>
          </>
        )}

      </div>
    </div>
  );
}