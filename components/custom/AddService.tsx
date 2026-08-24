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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Upload, X, Clock, DollarSign, AlertCircle, FileText, Users, Loader2, Crown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createService, CreateServiceData } from '@/lib/api/services';
import Link from 'next/link';

// Service Schema with validation - make boolean fields optional with defaults
const serviceSchema = z.object({
  name: z.string().min(2, { message: "Service name must be at least 2 characters" }),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }),
  price_type: z.enum(['fixed', 'hourly']),
  price: z.string().min(1, { message: "Please enter a price" }),
  min_duration: z.string().min(1, { message: "Please enter minimum duration" }),
  duration_unit: z.enum(['minutes', 'hours', 'days', 'weeks']),
  is_available: z.boolean().default(true).optional(),
  has_preparation_time: z.boolean().default(false).optional(),
  preparation_time: z.string().optional(),
  max_capacity: z.string().optional(),
  policies: z.string().optional(),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

interface AddServiceProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId?: string;
  vendorCategory?: string;
  onSuccess?: () => void;
}

export function AddService({ 
  isOpen, 
  onOpenChange, 
  vendorId, 
  vendorCategory,
  onSuccess 
}: AddServiceProps) {
  const supabase = createClient();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Service creation limit, checked live against the database every time
  // the sheet opens — same pattern as AddProducts' creationStatus.
  const [creationStatus, setCreationStatus] = useState<{
    allowed: boolean;
    currentCount: number;
    maxCount: number | null; // null = unlimited
  } | null>(null);
  const [isCheckingCreationLimit, setIsCheckingCreationLimit] = useState(true);

  const { register, handleSubmit, control, watch, formState: { errors }, reset } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      price_type: 'fixed',
      price: '',
      min_duration: '',
      duration_unit: 'hours',
      is_available: true,
      has_preparation_time: false,
      preparation_time: '',
      max_capacity: '',
      policies: '',
    },
  });

  const watchPriceType = watch('price_type');
  const watchHasPreparationTime = watch('has_preparation_time');

  // Check the creation limit whenever the sheet opens.
  useEffect(() => {
    if (!isOpen || !vendorId) {
      return;
    }

    let cancelled = false;
    setIsCheckingCreationLimit(true);

    (async () => {
      try {
        const { data, error } = await supabase.rpc('check_service_creation_allowed', {
          p_vendor_id: vendorId,
        });

        if (error) throw error;
        const row = data?.[0];

        if (cancelled) return;

        if (row) {
          setCreationStatus({
            allowed: row.allowed,
            currentCount: row.current_count,
            maxCount: row.max_count,
          });
        } else {
          setCreationStatus({ allowed: false, currentCount: 0, maxCount: 2 });
        }
      } catch (err) {
        console.error('Error checking service creation limit:', err);
        if (!cancelled) {
          setCreationStatus({ allowed: false, currentCount: 0, maxCount: 2 });
        }
      } finally {
        if (!cancelled) setIsCheckingCreationLimit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, vendorId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const onSubmit = async (data: ServiceFormValues) => {
    if (!vendorId) {
      toast.error("Please complete Account settings 100%");
      return;
    }

    const normalizedVendorCategory = (vendorCategory || "").trim();
    const isMissingVendorCategory = !normalizedVendorCategory || normalizedVendorCategory.toLowerCase() === "category" || normalizedVendorCategory === "--";

    if (isMissingVendorCategory) {
      toast.error("Please complete Account settings 100%");
      return;
    }

    // Re-check right before submitting, closing the gap where the sheet
    // was left open across a billing boundary.
    if (creationStatus && !creationStatus.allowed) {
      toast.error('You have reached your service limit for this billing period. Upgrade your plan to add more.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Upload image if exists
      let imageUrl = null;
      if (imageFile && vendorId) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${vendorId}/service-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('serivices')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('service_images')
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      // Prepare service data using vendor's category with proper typing
      const serviceData: CreateServiceData = {
        vendor_id: vendorId,
        name: data.name,
        category: vendorCategory,
        description: data.description,
        price_type: data.price_type,
        price: parseFloat(data.price),
        min_duration: data.min_duration ? parseInt(data.min_duration) : null,
        duration_unit: data.duration_unit,
        is_available: data.is_available ?? true,
        has_preparation_time: data.has_preparation_time ?? false,
        preparation_time: data.has_preparation_time && data.preparation_time ? parseInt(data.preparation_time) : 0,
        max_capacity: data.max_capacity ? parseInt(data.max_capacity) : null,
        policies: data.policies || null,
        image_url: imageUrl,
      };

      // Use the API function to create service
      const result = await createService(serviceData);

      if (!result) {
        throw new Error("Failed to create service");
      }

      // Only record the creation AFTER it succeeded — never spend the
      // count on a failed attempt.
      try {
        const { data: updatedTracking, error: trackingError } = await supabase.rpc(
          'record_service_creation',
          { p_vendor_id: vendorId }
        );
        if (trackingError) throw trackingError;

        const newCount = (updatedTracking?.counts?.addservice as number) ?? creationStatus?.currentCount ?? 0;
        setCreationStatus(prev => prev ? { ...prev, currentCount: newCount, allowed: prev.maxCount === null || newCount < prev.maxCount } : prev);
      } catch (trackingErr) {
        console.error('Service was created but failed to record creation count:', trackingErr);
      }

      toast.success('Service created successfully!');
      onSuccess?.();
      onOpenChange(false);
      reset();
      removeImage();
    } catch (error: any) {
      console.error('Error creating service:', error);
      toast.error(error.message || 'Failed to create service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const limitReached = !isCheckingCreationLimit && creationStatus && !creationStatus.allowed;
  const isFormDisabled = isSubmitting || !!limitReached;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="p-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-bold">Create New Service</SheetTitle>
            <SheetDescription className="text-sm text-gray-500">
              Fill in the details below to add a new service to your business.
              <span className="block mt-1 text-xs">
                Category: <span className="font-semibold text-black">{vendorCategory && vendorCategory !== 'Category' && vendorCategory !== '--' ? vendorCategory : '--'}</span>
              </span>
            </SheetDescription>
            {!isCheckingCreationLimit && creationStatus && creationStatus.maxCount !== null && (
              <p className="text-xs text-gray-400 mt-2">
                {creationStatus.currentCount} of {creationStatus.maxCount} services used this period
              </p>
            )}
          </SheetHeader>

          {/* Limit reached banner */}
          {limitReached && (
            <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <p className="text-xs text-red-700 flex-1">
                You've used all {creationStatus?.maxCount} service slots for this billing period.{' '}
                <Link href="/subscription" className="underline font-semibold hover:text-red-900">
                  Upgrade to add more
                </Link>
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className={`space-y-6 ${isFormDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Service Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Service Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Premium Hair Styling, Electrical Repair"
                disabled={isFormDisabled}
                className={`h-11 ${errors.name ? 'border-red-500 focus-visible:ring-red-500' : 'border-gray-300 focus-visible:ring-black'}`}
                {...register('name')}
              />
              <p className="text-xs text-gray-400">Give your service a clear and descriptive name</p>
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Describe your service in detail - what's included, special features, etc."
                disabled={isFormDisabled}
                className={`min-h-[120px] ${errors.description ? 'border-red-500 focus-visible:ring-red-500' : 'border-gray-300 focus-visible:ring-black'}`}
                {...register('description')}
              />
              <p className="text-xs text-gray-400">Include all important details to set clear expectations</p>
              {errors.description && (
                <p className="text-xs text-red-500">{errors.description.message}</p>
              )}
            </div>

            {/* Pricing Section */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pricing
              </h4>

              {/* Price Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Pricing Model <span className="text-red-500">*</span></Label>
                <Controller
                  name="price_type"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      onValueChange={(value: 'fixed' | 'hourly') => {
                        field.onChange(value);
                      }}
                      defaultValue={field.value}
                      className="flex gap-6"
                      disabled={isFormDisabled}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fixed" id="fixed" className="border-gray-400" />
                        <Label htmlFor="fixed" className="cursor-pointer text-sm font-medium">Minimum Amount</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="hourly" id="hourly" className="border-gray-400" />
                        <Label htmlFor="hourly" className="cursor-pointer text-sm font-medium">Hourly Rate</Label>
                      </div>
                    </RadioGroup>
                  )}
                />
                {errors.price_type && (
                  <p className="text-xs text-red-500">{errors.price_type.message}</p>
                )}
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price" className="text-sm font-medium text-gray-700">
                  {watchPriceType === 'hourly' ? 'Price per Hour' : 'Minimum Price'} <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder={watchPriceType === 'hourly' ? 'e.g., 75' : 'e.g., 50'}
                    disabled={isFormDisabled}
                    className={`pl-8 h-11 ${errors.price ? 'border-red-500 focus-visible:ring-red-500' : 'border-gray-300 focus-visible:ring-black'}`}
                    {...register('price')}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  {watchPriceType === 'hourly' 
                    ? 'Set your hourly rate for this service' 
                    : 'Set the minimum starting price for this service'}
                </p>
                {errors.price && (
                  <p className="text-xs text-red-500">{errors.price.message}</p>
                )}
              </div>
            </div>

            {/* Duration Section */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Duration
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_duration" className="text-sm font-medium text-gray-700">
                    Minimum Duration <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="min_duration"
                    type="number"
                    placeholder="e.g., 30, 1, 2"
                    disabled={isFormDisabled}
                    className={`h-11 ${errors.min_duration ? 'border-red-500 focus-visible:ring-red-500' : 'border-gray-300 focus-visible:ring-black'}`}
                    {...register('min_duration')}
                  />
                  {errors.min_duration && (
                    <p className="text-xs text-red-500">{errors.min_duration.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration_unit" className="text-sm font-medium text-gray-700">
                    Unit <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    name="duration_unit"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isFormDisabled}>
                        <SelectTrigger className="h-11 border-gray-300 focus-visible:ring-black">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">Minutes</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="weeks">Weeks</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.duration_unit && (
                    <p className="text-xs text-red-500">{errors.duration_unit.message}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400">Minimum time required for this service</p>
            </div>

            {/* Preparation Time Toggle */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium text-gray-700">Preparation Time</Label>
                  <p className="text-xs text-gray-400">Does this service require preparation time?</p>
                </div>
                <Controller
                  name="has_preparation_time"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      disabled={isFormDisabled}
                      className="data-[state=checked]:bg-black"
                    />
                  )}
                />
              </div>

              {watchHasPreparationTime && (
                <div className="space-y-2 pt-2 border-t border-gray-200">
                  <Label htmlFor="preparation_time" className="text-sm font-medium text-gray-700">
                    Preparation Time (minutes) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="preparation_time"
                    type="number"
                    placeholder="e.g., 15, 30, 60"
                    disabled={isFormDisabled}
                    className="h-11 border-gray-300 focus-visible:ring-black"
                    {...register('preparation_time')}
                  />
                  <p className="text-xs text-gray-400">Time needed before the service can start</p>
                </div>
              )}
            </div>

            {/* Max Capacity */}
            <div className="space-y-2">
              <Label htmlFor="max_capacity" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Max Capacity (Optional)
              </Label>
              <Input
                id="max_capacity"
                type="number"
                placeholder="e.g., 5, 10, 20"
                disabled={isFormDisabled}
                className="h-11 border-gray-300 focus-visible:ring-black"
                {...register('max_capacity')}
              />
              <p className="text-xs text-gray-400">Maximum number of people that can be accommodated</p>
            </div>

            {/* Policies */}
            <div className="space-y-2">
              <Label htmlFor="policies" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Policies (Optional)
              </Label>
              <Textarea
                id="policies"
                placeholder="e.g., Cancellation policy, rescheduling terms, deposit requirements..."
                disabled={isFormDisabled}
                className="min-h-[80px] border-gray-300 focus-visible:ring-black"
                {...register('policies')}
              />
              <p className="text-xs text-gray-400">Add any policies related to this service</p>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Service Image</Label>
              <div className={`border-2 border-dashed rounded-lg p-6 text-center relative transition-all hover:border-gray-400 ${
                imagePreview ? 'border-gray-300 bg-gray-50' : 'border-gray-300 bg-gray-50/50'
              }`}>
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Service preview"
                      className="max-h-48 rounded-lg object-contain"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      disabled={isFormDisabled}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-md disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                      <Upload className="h-6 w-6 text-gray-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">Click to upload an image</p>
                    <p className="text-xs text-gray-400">SVG, PNG, JPG (Max 5MB)</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isFormDisabled}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Availability Switch */}
            <div className="flex flex-row items-center justify-between rounded-lg border border-gray-200 p-4 bg-gray-50">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-gray-700">Available</Label>
                <p className="text-xs text-gray-400">Make this service available for booking</p>
              </div>
              <Controller
                name="is_available"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value || true}
                    onCheckedChange={field.onChange}
                    disabled={isFormDisabled}
                    className="data-[state=checked]:bg-black"
                  />
                )}
              />
            </div>

            <SheetFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-11 border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || isCheckingCreationLimit || !!limitReached}
                className="flex-1 h-11 bg-black hover:bg-gray-800 text-white"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </span>
                ) : isCheckingCreationLimit ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking...
                  </span>
                ) : (
                  'Create Service'
                )}
              </Button>
            </SheetFooter>
            {limitReached && (
              <p className="text-xs text-red-600 text-center -mt-2 font-medium">
                Limit reached.{' '}
                <Link href="/subscription" className="underline hover:text-red-800">
                  Upgrade
                </Link>{' '}
                to add more services.
              </p>
            )}
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}