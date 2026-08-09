"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import logoImage from "@/app/assets/logo/logo.png";
import { PayHerePayment } from "@/components/custom/PayHerePayment";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client"; // adjust to your supabase client path

interface PlanFeatureGroup {
  label: string;
  items: string[];
}

interface Plan {
  id: string;
  name: string;
  price: string;
  priceSuffix: string;
  tagline: string;
  commission: string;
  groups: PlanFeatureGroup[];
  highlighted?: boolean;
}

const plans: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price: "40",
    priceSuffix: "/month",
    tagline: "Get started and list your business at no cost.",
    commission: "15%",
    groups: [
      { label: "Limits", items: ["2 services", "3 products"] },
      { label: "Support", items: ["24/7 support"] },
      { label: "Commission", items: ["15% per order", "15% per reservation"] },
      { label: "Management", items: ["2x profile management", "2x service management", "2x product management"] },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "1500.00",
    priceSuffix: "/month",
    tagline: "More room to grow, with lower fees on every sale.",
    commission: "13%",
    highlighted: true,
    groups: [
      { label: "Limits", items: ["5 services", "10 products"] },
      { label: "Support", items: ["24/7 support"] },
      { label: "Commission", items: ["13% per order", "13% per reservation"] },
      { label: "Management", items: ["10x profile management", "10x service management", "10x product management"] },
      { label: "Visibility", items: ["View your 5 most recent customers"] },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "3500.00",
    priceSuffix: "/month",
    tagline: "No limits on listings, full visibility into your customers.",
    commission: "13%",
    groups: [
      { label: "Limits", items: ["Unlimited services", "Unlimited products"] },
      { label: "Support", items: ["24/7 support"] },
      { label: "Commission", items: ["13% per order", "13% per reservation"] },
      { label: "Management", items: ["Unlimited profile management", "Unlimited service management", "Unlimited product management"] },
      { label: "Visibility", items: ["View all customers"] },
    ],
  },
];

export default function SubscriptionPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [userId, setUserId] = useState('');
  const [userData, setUserData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Sri Lanka',
  });
  const [loadingUser, setLoadingUser] = useState(true);

  // Load user + vendor from Supabase
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingUser(false); return; }

      setUserId(user.id);

      // Get vendor
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id, vendor_name, address, branch')
        .eq('user_id', user.id)
        .single();

      if (vendor) setVendorId(vendor.id);

      // Build userData from auth + vendor
      const meta = user.user_metadata || {};
      setUserData({
        first_name: meta.first_name || meta.full_name?.split(' ')[0] || 'User',
        last_name: meta.last_name || meta.full_name?.split(' ')[1] || '',
        email: user.email || '',
        phone: meta.phone || '0700000000',
        address: vendor?.address || 'N/A',
        city: vendor?.branch || 'Colombo',
        country: 'Sri Lanka',
      });

      setLoadingUser(false);
    };
    load();
  }, []);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    // All plans go through PayHere — including basic (40 LKR)
    setPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = async (response: any) => {
    setIsProcessing(false);
    setPaymentDialogOpen(false);
    toast.success('Payment successful! Your subscription has been activated.');
    console.log('Payment success:', response);
  };

  const handlePaymentCancel = () => {
    setIsProcessing(false);
    setPaymentDialogOpen(false);
    setSelectedPlan(null);
    toast.info('Payment cancelled.');
  };

  const handlePaymentError = (error: any) => {
    setIsProcessing(false);
    console.error('Payment error:', error);
    toast.error('Payment failed. Please try again.');
  };

  const PaymentContent = () => (
    <div className="space-y-4 py-2">
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-100">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Plan</span>
          <span className="font-medium text-gray-900">
            {plans.find(p => p.id === selectedPlan)?.name}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Amount</span>
          <span className="font-medium text-gray-900">
            Rs. {parseFloat(plans.find(p => p.id === selectedPlan)?.price || '0').toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Billing</span>
          <span className="font-medium text-gray-900">Monthly</span>
        </div>
      </div>

      {loadingUser ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Loading your details...</span>
        </div>
      ) : (
        <PayHerePayment
          planId={selectedPlan || 'basic'}
          planName={plans.find(p => p.id === selectedPlan)?.name || ''}
          amount={plans.find(p => p.id === selectedPlan)?.price || '40'}
          vendorId={vendorId}
          userId={userId}
          userData={userData}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
          onError={handlePaymentError}
          isSubmitting={isProcessing}
        />
      )}

      <div className="text-center pt-2">
        <p className="text-xs text-gray-400">
          Secured by PayHere. Your payment information is protected with industry-standard encryption.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 py-3.5 flex items-center">
          <Link href="/" className="inline-flex items-center gap-3 text-gray-600 hover:text-black transition-colors group">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <Image src={logoImage} alt="Logo" width={95} className="w-24" priority />
          </Link>
        </div>
      </div>

      {/* Main */}
      <div className="container mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Subscription plans
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Choose the plan that fits your business
          </h1>
          <p className="mt-3 text-gray-500 text-base">
            Upgrade or downgrade anytime. Lower commission rates and higher limits as you grow.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isDark = plan.highlighted;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border transition-all duration-300 ${
                  isDark
                    ? "bg-gray-900 border-gray-900 shadow-xl lg:-translate-y-3"
                    : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-md"
                } ${isSelected && !isDark ? "ring-2 ring-gray-900 border-gray-900" : ""}
                ${isSelected && isDark ? "ring-2 ring-emerald-500" : ""}`}
              >
                {isDark && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                      Most popular
                    </span>
                  </div>
                )}

                <div className={`p-7 sm:p-8 ${isDark ? "text-white" : "text-gray-900"}`}>
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  <p className={`mt-1.5 text-sm leading-relaxed ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {plan.tagline}
                  </p>
                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-bold tracking-tight">
                      Rs. {plan.price}
                    </span>
                    <span className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {plan.priceSuffix}
                    </span>
                  </div>

                  <div className={`mt-5 flex items-center justify-between rounded-lg px-4 py-3 ${
                    isDark ? "bg-white/5 border border-white/10" : "bg-gray-50 border border-gray-100"
                  }`}>
                    <span className={`text-xs font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      Commission per order &amp; reservation
                    </span>
                    <span className={`text-lg font-bold tabular-nums ${isDark ? "text-emerald-400" : "text-gray-900"}`}>
                      {plan.commission}
                    </span>
                  </div>

                  <Button
                    onClick={() => handlePlanSelect(plan.id)}
                    className={`mt-6 w-full h-11 font-semibold transition-colors ${
                      isSelected
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : isDark
                        ? "bg-white text-gray-900 hover:bg-gray-100"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                    }`}
                  >
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="h-4 w-4" />
                        Selected
                      </span>
                    ) : (
                      plan.id === 'basic' ? 'Start Basic' : `Choose ${plan.name}`
                    )}
                  </Button>
                </div>

                <div className={`flex-1 px-7 sm:px-8 pb-8 space-y-5 ${
                  isDark ? "border-t border-white/10" : "border-t border-gray-100"
                } pt-6`}>
                  {plan.groups.map((group) => (
                    <div key={group.label}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${
                        isDark ? "text-gray-500" : "text-gray-400"
                      }`}>
                        {group.label}
                      </p>
                      <ul className="space-y-1.5">
                        {group.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <Check className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                              isDark ? "text-emerald-400" : "text-emerald-600"
                            }`} />
                            <span className={`text-sm leading-snug ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-14 text-sm text-gray-500">
          <p>Need help?{" "}
            <a href="#" className="text-gray-900 font-medium hover:underline">Contact sales</a>
          </p>
        </div>
      </div>

      {/* Dialog — desktop */}
      {!isMobile && (
        <Dialog open={paymentDialogOpen} onOpenChange={(open) => {
          if (!open) { setPaymentDialogOpen(false); setSelectedPlan(null); }
        }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Complete Your Payment</DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                Subscribing to the <strong>{plans.find(p => p.id === selectedPlan)?.name}</strong> plan.
              </DialogDescription>
            </DialogHeader>
            <PaymentContent />
          </DialogContent>
        </Dialog>
      )}

      {/* Sheet — mobile */}
      {isMobile && (
        <Sheet open={paymentDialogOpen} onOpenChange={(open) => {
          if (!open) { setPaymentDialogOpen(false); setSelectedPlan(null); }
        }}>
          <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-3xl">
            <SheetHeader>
              <SheetTitle className="text-xl font-semibold">Complete Your Payment</SheetTitle>
              <SheetDescription className="text-sm text-gray-500">
                Subscribing to the <strong>{plans.find(p => p.id === selectedPlan)?.name}</strong> plan.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <PaymentContent />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}