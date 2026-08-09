"use client";

import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center space-y-5">
        <XCircle className="h-12 w-12 text-gray-400 mx-auto" />
        <h1 className="text-xl font-semibold text-gray-900">Payment cancelled</h1>
        <p className="text-sm text-gray-500">
          No charge was made. You can subscribe anytime from your dashboard.
        </p>
        <Button
          onClick={() => router.push('/subscription')}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white h-11"
        >
          Back to plans
        </Button>
      </div>
    </div>
  );
}