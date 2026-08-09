"use client";

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  DollarSign,
  Users,
  AlertCircle,
  FileText,
  Calendar,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  ArrowLeft,
  Loader2,
  Tag,
  Building2,
  Hash,
} from 'lucide-react';
import { getServiceById, Service } from '@/lib/api/services';
import { toast } from 'sonner';

interface ServiceDetailsProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function ServiceDetails({
  isOpen,
  onOpenChange,
  serviceId,
  onEdit,
  onDelete,
}: ServiceDetailsProps) {
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<Service | null>(null);

  // Fetch service data
  useEffect(() => {
    const fetchService = async () => {
      if (!serviceId || !isOpen) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getServiceById(serviceId);
        setService(data);
      } catch (error) {
        console.error('Error fetching service:', error);
        toast.error('Failed to load service details');
      } finally {
        setLoading(false);
      }
    };

    fetchService();
  }, [serviceId, isOpen]);

  // Format price
  const formatPrice = () => {
    if (!service) return '';
    if (service.price_type === 'hourly') {
      return `Rs. ${service.price}/hr`;
    }
    return `Rs. ${service.price}`;
  };

  // Format duration
  const formatDuration = () => {
    if (!service?.min_duration || !service?.duration_unit) return 'Not specified';
    const unitMap = {
      minutes: 'min',
      hours: 'hr',
      days: 'day',
      weeks: 'wk',
    };
    return `${service.min_duration} ${unitMap[service.duration_unit]}${service.min_duration > 1 ? 's' : ''}`;
  };

  // Get status color
  const getStatusColor = (isAvailable: boolean) => {
    return isAvailable
      ? 'bg-emerald-500 text-white'
      : 'bg-gray-400 text-white';
  };

  // Get status text
  const getStatusText = (isAvailable: boolean) => {
    return isAvailable ? 'Available' : 'Unavailable';
  };

  // Get price type label
  const getPriceTypeLabel = () => {
    if (!service) return '';
    return service.price_type === 'hourly' ? 'Hourly Rate' : 'Minimum Amount';
  };

  // Get price type badge color
  const getPriceTypeColor = () => {
    if (!service) return '';
    return service.price_type === 'hourly'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-purple-50 text-purple-700 border-purple-200';
  };

  // Get initials for fallback
  const getInitials = () => {
    if (!service?.name) return 'S';
    return service.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  // Handle edit click
  const handleEdit = () => {
    if (onEdit && serviceId) {
      onEdit(serviceId);
      onOpenChange(false);
    }
  };

  // Handle delete click
  const handleDelete = () => {
    if (onDelete && serviceId) {
      onDelete(serviceId);
      onOpenChange(false);
    }
  };

  if (loading) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-full overflow-y-auto p-0">
          {/* SheetContent renders a Radix Dialog under the hood, which requires a
              DialogTitle in every state for screen-reader accessibility. The
              loading view has no visible heading by design, so the title is
              visually hidden rather than shown. */}
          <VisuallyHidden asChild>
            <SheetTitle>Loading service details</SheetTitle>
          </VisuallyHidden>
          <div className="flex items-center justify-center min-h-screen">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="text-sm text-gray-500">Loading service details...</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!service) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-full overflow-y-auto p-0">
          <VisuallyHidden asChild>
            <SheetTitle>Service not found</SheetTitle>
          </VisuallyHidden>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <p className="text-gray-500">Service not found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-full overflow-y-auto p-0 bg-white">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4 md:px-8 md:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-9 w-9 rounded-full hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <SheetTitle className="text-lg md:text-xl font-semibold text-gray-900 leading-tight">
                  Service Details
                </SheetTitle>
                <SheetDescription className="text-xs md:text-sm text-gray-500 leading-snug">
                  Complete information about this service
                </SheetDescription>
              </div>
            </div>
            <Badge className={getStatusColor(service.is_available)}>
              {getStatusText(service.is_available)}
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-4 py-6 md:px-8 md:py-10 max-w-3xl mx-auto">
          {/* Image */}
          <div className="relative w-full h-56 md:h-72 lg:h-80 bg-gray-50 rounded-lg overflow-hidden">
            {service.image_url ? (
              <img
                src={service.image_url}
                alt={service.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <span className="text-5xl font-semibold text-gray-300 tracking-wide">
                    {getInitials()}
                  </span>
                  <p className="text-sm text-gray-400 mt-3">No image available</p>
                </div>
              </div>
            )}
            {service.category && (
              <Badge className="absolute bottom-4 left-4 bg-black/70 text-white border-0 hover:bg-black/70 text-sm px-3 py-1">
                <Tag className="h-3.5 w-3.5 mr-1.5" />
                {service.category}
              </Badge>
            )}
          </div>

          {/* Name & Price - Single Line with Type Below */}
          <div className="mt-8 pb-6 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
              <div>
                <h2 className="text-2xl md:text-[28px] font-semibold text-gray-900 leading-tight tracking-tight">
                  {service.name}
                </h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className={`text-xs font-medium px-2.5 py-0.5 ${getPriceTypeColor()}`}>
                    {getPriceTypeLabel()}
                  </Badge>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500 capitalize">{service.price_type}</span>
                </div>
              </div>
              <div className="text-2xl md:text-[28px] font-semibold text-gray-900 leading-tight whitespace-nowrap">
                {formatPrice()}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="mt-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-1">
              Overview
            </h3>

            <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 leading-relaxed">Duration</span>
              </div>
              <span className="text-sm font-medium text-gray-900 leading-relaxed">
                {formatDuration()}
              </span>
            </div>

            <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 leading-relaxed">Max Capacity</span>
              </div>
              <span className="text-sm font-medium text-gray-900 leading-relaxed">
                {service.max_capacity ? `${service.max_capacity} people` : 'Unlimited'}
              </span>
            </div>

            <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 leading-relaxed">Preparation Time</span>
              </div>
              <span className="text-sm font-medium text-gray-900 leading-relaxed">
                {service.has_preparation_time ? `${service.preparation_time} minutes` : 'Not required'}
              </span>
            </div>

            <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 leading-relaxed">Category</span>
              </div>
              <span className="text-sm font-medium text-gray-900 leading-relaxed">
                {service.category || 'Not specified'}
              </span>
            </div>

            <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 leading-relaxed">Price Type</span>
              </div>
              <span className="text-sm font-medium text-gray-900 leading-relaxed capitalize">
                {service.price_type === 'hourly' ? 'Hourly Rate' : 'Minimum Amount'} ({service.price_type})
              </span>
            </div>

            <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                {service.is_available ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm text-gray-600 leading-relaxed">Availability</span>
              </div>
              <Badge className={getStatusColor(service.is_available)}>
                {getStatusText(service.is_available)}
              </Badge>
            </div>

            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-8 mb-1">
              Record
            </h3>

            <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Hash className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 leading-relaxed">Service ID</span>
              </div>
              <span className="text-xs font-mono text-gray-500 leading-relaxed">
                {service.id.slice(0, 8)}...{service.id.slice(-4)}
              </span>
            </div>

            <div className="flex items-center justify-between py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 leading-relaxed">Created</span>
              </div>
              <span className="text-sm text-gray-700 leading-relaxed">
                {new Date(service.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>

            <div className="flex items-center justify-between py-3.5">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 leading-relaxed">Last Updated</span>
              </div>
              <span className="text-sm text-gray-700 leading-relaxed">
                {new Date(service.updated_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Tabs for Description & Policies */}
          {(service.description || service.policies) && (
            <div className="pt-8 mt-2 border-t border-gray-100">
              <Tabs defaultValue="description" className="w-full">
                <TabsList className="bg-transparent border-b-1 p-1 rounded-none w-full sm:w-auto">
                  {service.description && (
                    <TabsTrigger
                      value="description"
                      className="flex-1 sm:flex-none data-[state=active]:bg-transparent data-[state=active]:shadow-0 rounded-none px-4 py-2 text-sm font-medium text-gray-600 data-[state=active]:text-gray-900 data-[state=active]:border-b-2 transition-all"
                    >
                      <FileText className="h-3.5 w-3.5 mr-2" />
                      Description
                    </TabsTrigger>
                  )}
                  {service.policies && (
                    <TabsTrigger
                      value="policies"
                      className="flex-1 sm:flex-none data-[state=active]:bg-transparent data-[state=active]:shadow-0 rounded-none px-4 py-2 text-sm font-medium text-gray-600 data-[state=active]:text-gray-900 data-[state=active]:border-b-2 transition-all"
                    >
                      <AlertCircle className="h-3.5 w-3.5 mr-2" />
                      Policies
                    </TabsTrigger>
                  )}
                </TabsList>

                {service.description && (
                  <TabsContent value="description" className="mt-0">
                    <div className="bg-transparent rounded-lg p-4 md:p-6">
                      <p className="text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {service.description}
                      </p>
                    </div>
                  </TabsContent>
                )}

                {service.policies && (
                  <TabsContent value="policies" className="mt-0">
                    <div className="bg-transparent rounded-lg p-4 md:p-6">
                      <p className="text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {service.policies}
                      </p>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4 md:px-8">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Close
            </Button>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
              {onEdit && (
                <Button
                  onClick={handleEdit}
                  className="w-full sm:w-auto bg-black hover:bg-gray-800 text-white"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}