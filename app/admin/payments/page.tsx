"use client";

import React, { useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { useAdminPayments } from "@/hooks/use-admin-payments";
import type { PaymentTypeFilter } from "@/lib/api/admin-payments";

const FILTERS: { label: string; value: PaymentTypeFilter }[] = [
  { label: "All", value: "all" },
  { label: "Subscriptions", value: "subscription" },
  { label: "Orders", value: "order" },
  { label: "Reservations", value: "reservation" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-LK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeBadgeClass(type: string) {
  switch (type) {
    case "Subscription":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Order":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Reservation":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-gray-50 text-gray-600 border-gray-200";
  }
}

export default function AdminPaymentsPage() {
  const [filter, setFilter] = useState<PaymentTypeFilter>("all");
  const { rows, isLoading, isError, error } = useAdminPayments(filter);

  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  return (
    <div className="min-h-screen bg-[#FAFAF9] px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
            <p className="text-sm text-gray-500 mt-1">
              Every recorded payment across subscriptions, orders, and reservations.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Total ({filter === "all" ? "all" : filter})
            </p>
            <p className="text-xl font-bold text-gray-900">
              Rs. {total.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filter === f.value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading payments...</span>
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-sm text-red-600">
              Failed to load payments{error ? `: ${(error as Error).message}` : ""}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              No payments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{r.customerName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeBadgeClass(
                            r.type
                          )}`}
                        >
                          {r.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">
                        {r.method.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.reference}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                        Rs. {Number(r.amount).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        {r.receiptUrl ? (
                          <a
                            href={r.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}