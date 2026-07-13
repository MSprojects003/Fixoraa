"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, MapPin, ChevronRight, Mail, Phone } from 'lucide-react';

interface BusinessHeaderProps {
  businessData: {
    id?: string;
    name: string;
    branch: string;
    category: string;
    address: string;
    logo: string;
    status: string;
    profileImage?: string | null;
    firstName?: string;
    lastName?: string;
    email?: string;
    vendorImage?: string | null;
    nicFront?: string | null;
    nicBack?: string | null;
    nicVerified?: boolean;
    voCertificate?: string | null;
    voVerified?: boolean;
    phone?: string | null;
  };
  completionPercentage: number;
  isLoading?: boolean;
  onOpenAccountSheet?: () => void;
}

export function BusinessHeader({
  businessData,
  completionPercentage,
  isLoading = false,
  onOpenAccountSheet,
}: BusinessHeaderProps) {
  // Get initials for avatar fallback
  const getInitials = () => {
    if (businessData.firstName && businessData.lastName) {
      return (businessData.firstName[0] + businessData.lastName[0]).toUpperCase();
    }
    if (businessData.name) {
      return businessData.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    }
    return 'U';
  };

  // Status config — dot color, label, text color all derive from one source of truth
  const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
    active: { label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    pending: { label: 'Pending review', dot: 'bg-amber-500', text: 'text-amber-700' },
    deleted: { label: 'Deleted', dot: 'bg-red-500', text: 'text-red-700' },
  };
  const status = statusConfig[businessData.status] ?? {
    label: businessData.status || 'Unknown',
    dot: 'bg-gray-400',
    text: 'text-gray-600',
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return '#22c55e'; // emerald-500
    if (percentage >= 50) return '#eab308'; // amber-500 (yellow-500)
    return '#ef4444'; // red-500
  };

  const getPercentageColorClass = (percentage: number) => {
    if (percentage >= 80) return 'text-emerald-700';
    if (percentage >= 50) return 'text-amber-700';
    return 'text-red-700';
  };

  const circleColor = getPercentageColor(completionPercentage);
  const colorClass = getPercentageColorClass(completionPercentage);

  // SVG ring geometry
  const svgSize = 80;
  const radius = 37;
  const strokeWidth = 4.5;
  const center = svgSize / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, completionPercentage)) / 100) * circumference;

  const displayImage = businessData.profileImage || businessData.vendorImage || businessData.logo || undefined;

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-6">
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              <Skeleton className="h-20 w-20 rounded-full shrink-0" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            </div>

            <div className="hidden sm:block w-px self-stretch bg-gray-100" />
            <div className="sm:hidden h-px w-full bg-gray-100" />

            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 min-w-0">
              <div className="space-y-2 sm:max-w-[260px] sm:flex-1">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3.5 w-1/2" />
              </div>
              <div className="flex-1 sm:max-w-[260px] space-y-2">
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-6">
          {/* Identity block: avatar with completion ring + name + status */}
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <div className="relative shrink-0" style={{ width: svgSize, height: svgSize }}>
              <svg
                width={svgSize}
                height={svgSize}
                viewBox={`0 0 ${svgSize} ${svgSize}`}
                className="absolute inset-0 -rotate-90"
              >
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke="#e5e7eb"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={circleColor}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: offset,
                    transition: 'stroke-dashoffset 0.8s ease-in-out',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Avatar className="h-[60px] w-[60px] rounded-full border-2 border-white shadow-sm">
                  <AvatarImage src={displayImage} alt={businessData.name} className="object-cover" />
                  <AvatarFallback className="bg-gray-900 text-white text-base font-semibold tracking-tight">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-full px-1.5">
                <span className={`text-[10px] font-bold tabular-nums ${colorClass}`}>
                  {completionPercentage}%
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full ${status.dot} opacity-75 ${
                      businessData.status === 'pending' ? 'animate-ping' : ''
                    }`}
                  />
                  <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${status.dot}`} />
                </span>
                <span className={`text-[11px] font-medium uppercase tracking-wide ${status.text}`}>
                  {status.label}
                </span>
              </div>

              <h1 className="mt-1 text-xl sm:text-2xl font-bold text-gray-900 tracking-tight truncate max-w-[200px] sm:max-w-xs">
                {businessData.name}
              </h1>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="truncate">{businessData.branch}</span>
                </span>
                {businessData.category && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="truncate">{businessData.category}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Divider — vertical on desktop, horizontal on mobile */}
          <div className="hidden sm:block w-px self-stretch bg-gray-100" />
          <div className="sm:hidden h-px w-full bg-gray-100" />

          {/* Right block: contact details + completion meter */}
          <div className="flex-1 flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 min-w-0">
            <div className="flex flex-col gap-1.5 text-sm text-gray-500 sm:flex-1 sm:min-w-0">
              <span className="flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400 mt-0.5" />
                <span className="leading-snug">{businessData.address}</span>
              </span>
              {businessData.email && (
                <span className="flex items-center gap-1.5 min-w-0">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="truncate">{businessData.email}</span>
                </span>
              )}
              {businessData.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span>{businessData.phone}</span>
                </span>
              )}
            </div>

            <div className="sm:w-[220px] sm:shrink-0">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Profile complete
                </span>
                <span className={`text-sm font-bold tabular-nums ${colorClass}`}>
                  {completionPercentage}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.min(100, Math.max(0, completionPercentage))}%`,
                    backgroundColor: circleColor,
                  }}
                />
              </div>
              {completionPercentage < 100 ? (
                <button
                  onClick={onOpenAccountSheet}
                  className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors group"
                >
                  Finish setting up your business profile
                  <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <p className="mt-1.5 text-xs text-gray-400">
                  Your business profile is complete
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}