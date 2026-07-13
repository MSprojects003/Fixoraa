"use client";

import React, { useState, useEffect, useRef } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Upload, X, Clock, DollarSign, AlertCircle,
  FileText, Users, Loader2, Crown,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getServiceById, updateService, Service } from '@/lib/api/services';
import { toast } from 'sonner';
import Link from 'next/link';

interface EditServiceProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId?: string;
  vendorId?: string;
  onSuccess?: () => void;
}

// Fields tracked for per-service edit limits.
// Toggles (is_available, has_preparation_time) are intentionally left
// ungated — same as EditProduct's is_available / is_featured.
const LIMITED_SERVICE_FIELDS = [
  'name',
  'description',
  'price_type',
  'price',
  'min_duration',
  'duration_unit',
  'preparation_time',
  'max_capacity',
  'policies',
  'image',
];

// Map subscription types to max edits per field per billing period
const getMaxEditsForPlan = (subscriptionType: string): number | null => {
  const map: Record<string, number | null> = {
    'basic': 2,
    'pro': 10,
    'premium': null, // unlimited
    'enterprise': null, // unlimited
  };
  return map[subscriptionType?.toLowerCase()] ?? 2;
};

export function EditService({
  isOpen,
  onOpenChange,
  serviceId,
  vendorId,
  onSuccess,
}: EditServiceProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Per-service, per-field edit tracking — exact mirror of EditProduct.
  const [planType, setPlanType] = useState<string>('basic');
  const [maxEdits, setMaxEdits] = useState<number | null>(2); // null = unlimited
  const [editCounts, setEditCounts] = useState<Record<string, number>>({});
  const [savingFields, setSavingFields] = useState<Record<string, boolean>>({});
  const [isCheckingLimits, setIsCheckingLimits] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_type: 'fixed' as 'fixed' | 'hourly',
    price: '',
    min_duration: '',
    duration_unit: 'hours' as 'minutes' | 'hours' | 'days' | 'weeks',
    is_available: true,
    has_preparation_time: false,
    preparation_time: '',
    max_capacity: '',
    policies: '',
    image_url: '',
  });

  // Baseline for "did this field actually change" comparisons on blur.
  // formData updates on every keystroke, so it can never be the baseline —
  // comparing against it would always read as "unchanged".
  // This ref only updates on initial load and on a confirmed DB save.
  const lastSavedRef = useRef<Record<string, string>>({});

  // ─── Fetch service data ───────────────────────────────────────────────
  useEffect(() => {
    const fetchService = async () => {
      if (!serviceId || !isOpen) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getServiceById(serviceId);

        if (data) {
          const next = {
            name: data.name || '',
            description: data.description || '',
            price_type: (data.price_type || 'fixed') as 'fixed' | 'hourly',
            price: data.price?.toString() || '',
            min_duration: data.min_duration?.toString() || '',
            duration_unit: (data.duration_unit || 'hours') as 'minutes' | 'hours' | 'days' | 'weeks',
            is_available: data.is_available ?? true,
            has_preparation_time: data.has_preparation_time ?? false,
            preparation_time: data.preparation_time?.toString() || '',
            max_capacity: data.max_capacity?.toString() || '',
            policies: data.policies || '',
            image_url: data.image_url || '',
          };
          setFormData(next);

          // Seed the baseline — note the image key is 'image', not 'image_url',
          // to match the LIMITED_SERVICE_FIELDS entry and the RPC p_field value.
          lastSavedRef.current = {
            name: next.name,
            description: next.description,
            price_type: next.price_type,
            price: next.price,
            min_duration: next.min_duration,
            duration_unit: next.duration_unit,
            preparation_time: next.preparation_time,
            max_capacity: next.max_capacity,
            policies: next.policies,
            image: next.image_url,
          };
          setImagePreview(data.image_url || null);
        }
      } catch (error) {
        console.error('[service-fetch] Error:', error);
        toast.error('Failed to load service data');
      } finally {
        setLoading(false);
      }
    };

    fetchService();
  }, [serviceId, isOpen]);

  // ─── Load edit-limit status ───────────────────────────────────────────
  // This properly reads the subscription_type from the vendors table
  useEffect(() => {
    if (!serviceId || !vendorId || !isOpen) {
      console.log(`[service-limits] skipping: serviceId="${serviceId}" vendorId="${vendorId}" isOpen=${isOpen}`);
      return;
    }

    let cancelled = false;
    setIsCheckingLimits(true);
    console.log(`[service-limits] checking for serviceId="${serviceId}" vendorId="${vendorId}"`);

    (async () => {
      try {
        // FIRST: Get the vendor's subscription type directly
        console.log('[service-limits] Fetching vendor subscription type...');
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendors')
          .select('subscription_type')
          .eq('id', vendorId)
          .single();

        if (vendorError) {
          console.error('[service-limits] Vendor lookup failed:', vendorError);
          throw vendorError;
        }

        const subscriptionType = vendorData?.subscription_type || 'basic';
        console.log(`[service-limits] Vendor subscription_type: "${subscriptionType}"`);

        // Set the plan type based on actual subscription
        setPlanType(subscriptionType);
        
        // Get max edits based on subscription
        const maxEditsForPlan = getMaxEditsForPlan(subscriptionType);
        setMaxEdits(maxEditsForPlan);

        // SECOND: Get existing edit counts from the service table
        console.log('[service-limits] Fetching edit counts from service...');
        const { data: serviceData, error: serviceError } = await supabase
          .from('services')
          .select('edit_tracking')
          .eq('id', serviceId)
          .single();

        if (!serviceError && serviceData?.edit_tracking) {
          console.log('[service-limits] Loaded edit counts:', serviceData.edit_tracking);
          setEditCounts(serviceData.edit_tracking as Record<string, number>);
        } else {
          console.log('[service-limits] No existing edit counts, starting fresh');
          setEditCounts({});
        }

        // Also try the RPC function if it exists (for future compatibility)
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_service_edit_status', {
            p_service_id: serviceId,
            p_vendor_id: vendorId,
          });

          if (!rpcError && rpcData?.[0]) {
            console.log('[service-limits] RPC returned data:', rpcData[0]);
            // Only override if RPC succeeded and has valid data
            const row = rpcData[0];
            if (row.plan_type) {
              setPlanType(row.plan_type);
              setMaxEdits(row.max_edits ?? null);
            }
            if (row.counts) {
              setEditCounts(row.counts as Record<string, number>);
            }
          }
        } catch (rpcErr) {
          // RPC function might not exist yet, that's fine - we already have the data
          console.log('[service-limits] RPC function not available, using direct data');
        }

      } catch (err) {
        console.error('[service-limits] Error loading limits:', err);
        // Fallback: try to get vendor subscription one more time
        try {
          const { data: vendorData } = await supabase
            .from('vendors')
            .select('subscription_type')
            .eq('id', vendorId)
            .single();
          
          const subType = vendorData?.subscription_type || 'basic';
          console.log(`[service-limits] Fallback: using subscription_type "${subType}"`);
          setPlanType(subType);
          setMaxEdits(getMaxEditsForPlan(subType));
          
          // Try to get edit counts one more time
          const { data: serviceData } = await supabase
            .from('services')
            .select('edit_tracking')
            .eq('id', serviceId)
            .single();
          
          if (serviceData?.edit_tracking) {
            setEditCounts(serviceData.edit_tracking as Record<string, number>);
          } else {
            setEditCounts({});
          }
        } catch (fallbackErr) {
          console.error('[service-limits] Fallback also failed:', fallbackErr);
          setPlanType('basic');
          setMaxEdits(2);
          setEditCounts({});
        }
      } finally {
        if (!cancelled) setIsCheckingLimits(false);
      }
    })();

    return () => { cancelled = true; };
  }, [serviceId, vendorId, isOpen, supabase]);

  // ─── Helpers ──────────────────────────────────────────────────────────
  const isUnlimited = maxEdits === null;

  const canEditField = (field: string): boolean => {
    if (!LIMITED_SERVICE_FIELDS.includes(field)) return true;
    if (isUnlimited) return true;
    return (editCounts[field] || 0) < (maxEdits as number);
  };

  const getRemainingEdits = (field: string): number => {
    if (!LIMITED_SERVICE_FIELDS.includes(field)) return Infinity;
    if (isUnlimited) return Infinity;
    return Math.max(0, (maxEdits as number) - (editCounts[field] || 0));
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ─── Core blur handler — mirrors EditProduct's handleBlur exactly ─────
  const handleBlur = async (field: string) => {
    console.log(`[service-blur] field="${field}" serviceId="${serviceId}" vendorId="${vendorId}"`);

    // Skip if still loading
    if (loading) {
      console.log('[service-blur] skipping - still loading');
      return;
    }

    if (!serviceId || !vendorId) {
      console.log('[service-blur] ABORTING: serviceId or vendorId missing');
      toast.error('Unable to save: Missing service or vendor information');
      return;
    }

    const value = formData[field as keyof typeof formData];

    if (LIMITED_SERVICE_FIELDS.includes(field)) {
      const baseline = lastSavedRef.current[field];
      console.log(`[service-blur] limited field. baseline="${baseline}" newValue="${value}"`);

      if (baseline === value) {
        console.log('[service-blur] unchanged, skipping save');
        return;
      }

      if (!canEditField(field)) {
        console.log(`[service-blur] BLOCKED. editCounts=`, editCounts, `maxEdits=${maxEdits}`);
        toast.error(
          `You've reached the edit limit for this field (${maxEdits} per billing period). Upgrade your plan for more.`
        );
        return;
      }
    }

    try {
      setSaving(true);
      setSavingFields(prev => ({ ...prev, [field]: true }));

      const updateData: Record<string, any> = {};

      if (field === 'name')                 updateData.name = value;
      else if (field === 'description')     updateData.description = value;
      else if (field === 'price_type')      updateData.price_type = value;
      else if (field === 'price')           updateData.price = parseFloat(value as string) || 0;
      else if (field === 'min_duration')    updateData.min_duration = value ? parseInt(value as string) : null;
      else if (field === 'duration_unit')   updateData.duration_unit = value;
      else if (field === 'is_available')    updateData.is_available = value;
      else if (field === 'has_preparation_time') updateData.has_preparation_time = value;
      else if (field === 'preparation_time') updateData.preparation_time = value ? parseInt(value as string) : 0;
      else if (field === 'max_capacity')    updateData.max_capacity = value ? parseInt(value as string) : null;
      else if (field === 'policies')        updateData.policies = value;

      console.log(`[service-blur] calling updateService(${serviceId})`, updateData);
      await updateService(serviceId, updateData);
      console.log('[service-blur] updateService completed');

      toast.success(`${field.replace(/_/g, ' ')} updated`);

      if (LIMITED_SERVICE_FIELDS.includes(field)) {
        lastSavedRef.current[field] = value as string;

        console.log(`[service-blur] updating edit tracking for p_field="${field}"`);
        
        // Try to use the RPC function first (if it exists)
        let trackingSucceeded = false;
        try {
          const { data: updatedTracking, error: trackingError } = await supabase.rpc(
            'record_service_field_edit',
            { p_service_id: serviceId, p_vendor_id: vendorId, p_field: field }
          );

          console.log('[service-blur] record_service_field_edit RAW response:', { updatedTracking, trackingError });

          if (!trackingError) {
            const counts = (updatedTracking?.counts as Record<string, number>) || {};
            console.log('[service-blur] new counts from RPC:', counts);
            setEditCounts(counts);
            trackingSucceeded = true;
          } else {
            console.warn('[service-blur] RPC tracking failed, using manual tracking:', trackingError);
          }
        } catch (trackingErr) {
          console.warn('[service-blur] RPC tracking exception, using manual tracking:', trackingErr);
        }

        // If RPC failed, manually update the edit_tracking JSONB column
        if (!trackingSucceeded) {
          try {
            const currentCount = (editCounts[field] || 0);
            const newCounts = { ...editCounts, [field]: currentCount + 1 };
            
            console.log('[service-blur] Manual update with new counts:', newCounts);
            
            const { error: updateError } = await supabase
              .from('services')
              .update({ edit_tracking: newCounts })
              .eq('id', serviceId);

            if (updateError) {
              console.error('[service-blur] Manual tracking update failed:', updateError);
              throw updateError;
            }
            
            setEditCounts(newCounts);
            console.log('[service-blur] Manual tracking update succeeded');
          } catch (manualErr) {
            console.error('[service-blur] Manual tracking update failed:', manualErr);
            toast.error('Field saved, but the edit counter failed to update. Please refresh the page.');
          }
        }
      }
    } catch (error) {
      console.error('[service-blur] Error updating field:', error);
      toast.error('Failed to update field');
    } finally {
      setSaving(false);
      setSavingFields(prev => ({ ...prev, [field]: false }));
    }
  };

  // ─── Image upload ─────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (!serviceId || !vendorId) {
      toast.error('Service ID not found');
      return;
    }

    if (!canEditField('image')) {
      toast.error(`You've reached the edit limit for images (${maxEdits} per billing period). Upgrade your plan for more.`);
      return;
    }

    // Instant local preview while upload is in flight.
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    setSavingFields(prev => ({ ...prev, image: true }));
    setSaving(true);
    const loadingToast = toast.loading('Uploading image...');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${vendorId}/service-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('service_images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('service_images')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      await updateService(serviceId, { image_url: publicUrl });

      setImagePreview(publicUrl);
      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      lastSavedRef.current.image = publicUrl;
      toast.dismiss(loadingToast);
      toast.success('Image uploaded successfully');

      console.log('[service-image] updating edit tracking for p_field="image"');
      
      // Try RPC first, fallback to manual
      let trackingSucceeded = false;
      try {
        const { data: updatedTracking, error: trackingError } = await supabase.rpc(
          'record_service_field_edit',
          { p_service_id: serviceId, p_vendor_id: vendorId, p_field: 'image' }
        );
        if (!trackingError) {
          const counts = (updatedTracking?.counts as Record<string, number>) || {};
          setEditCounts(counts);
          trackingSucceeded = true;
        }
      } catch (trackingErr) {
        console.warn('[service-image] RPC tracking exception:', trackingErr);
      }

      if (!trackingSucceeded) {
        try {
          const currentCount = (editCounts.image || 0);
          const newCounts = { ...editCounts, image: currentCount + 1 };
          await supabase
            .from('services')
            .update({ edit_tracking: newCounts })
            .eq('id', serviceId);
          setEditCounts(newCounts);
        } catch (manualErr) {
          console.error('[service-image] Manual tracking failed:', manualErr);
          toast.error('Image saved, but the edit counter failed to update.');
        }
      }
    } catch (error: any) {
      console.error('[service-image] upload error:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to upload image');
    } finally {
      setSaving(false);
      setSavingFields(prev => ({ ...prev, image: false }));
    }
  };

  const removeImage = async () => {
    if (!serviceId || !vendorId) return;

    if (!canEditField('image')) {
      toast.error(`You've reached the edit limit for images (${maxEdits} per billing period). Upgrade your plan for more.`);
      return;
    }

    setSavingFields(prev => ({ ...prev, image: true }));
    setSaving(true);

    try {
      await updateService(serviceId, { image_url: null });

      setImagePreview(null);
      setFormData(prev => ({ ...prev, image_url: '' }));
      lastSavedRef.current.image = '';
      toast.success('Image removed');

      // Try RPC first, fallback to manual
      let trackingSucceeded = false;
      try {
        const { data: updatedTracking, error: trackingError } = await supabase.rpc(
          'record_service_field_edit',
          { p_service_id: serviceId, p_vendor_id: vendorId, p_field: 'image' }
        );
        if (!trackingError) {
          const counts = (updatedTracking?.counts as Record<string, number>) || {};
          setEditCounts(counts);
          trackingSucceeded = true;
        }
      } catch (trackingErr) {
        console.warn('[service-image] remove RPC tracking exception:', trackingErr);
      }

      if (!trackingSucceeded) {
        try {
          const currentCount = (editCounts.image || 0);
          const newCounts = { ...editCounts, image: currentCount + 1 };
          await supabase
            .from('services')
            .update({ edit_tracking: newCounts })
            .eq('id', serviceId);
          setEditCounts(newCounts);
        } catch (manualErr) {
          console.error('[service-image] remove manual tracking failed:', manualErr);
        }
      }
    } catch (error) {
      console.error('[service-image] remove error:', error);
      toast.error('Failed to remove image');
    } finally {
      setSaving(false);
      setSavingFields(prev => ({ ...prev, image: false }));
    }
  };

  // ─── Edit limit badge ─────────────────────────────────────────────────
  const renderEditLimit = (field: string) => {
    if (!LIMITED_SERVICE_FIELDS.includes(field)) return null;
    if (isCheckingLimits) return null;

    if (isUnlimited) {
      return (
        <span className="text-[11px] text-violet-600 font-medium flex items-center gap-1">
          <Crown className="h-3 w-3" />
          Unlimited
        </span>
      );
    }

    const remaining = getRemainingEdits(field);

    if (remaining === 0) {
      return (
        <span className="text-[11px] text-red-600 font-medium flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Limit reached
          <Link href="/subscription" className="underline hover:text-red-800 ml-1 font-semibold">
            Upgrade
          </Link>
        </span>
      );
    }

    return (
      <span className={`text-[11px] font-medium ${remaining <= 1 ? 'text-amber-600' : 'text-gray-400'}`}>
        {remaining} edit{remaining === 1 ? '' : 's'} left
      </span>
    );
  };

  // ─── Loading skeleton ─────────────────────────────────────────────────
  if (loading) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
          <VisuallyHidden asChild>
            <SheetTitle>Loading service</SheetTitle>
          </VisuallyHidden>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="text-sm text-gray-500">Loading service data...</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ─── Main form ────────────────────────────────────────────────────────
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 bg-white">
        <div className="p-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              Edit Service
              {saving && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </SheetTitle>
            <SheetDescription className="text-sm text-gray-500">
              Update your service details. Changes are saved automatically on blur.
            </SheetDescription>
            {!isCheckingLimits && !isUnlimited && (
              <p className="text-xs text-gray-400">
                {planType.charAt(0).toUpperCase() + planType.slice(1)} plan — {maxEdits} edits per field, per billing period
              </p>
            )}
          </SheetHeader>

          <div className="space-y-6">

            {/* Service Name */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Service Name <span className="text-red-500">*</span>
                </Label>
                {renderEditLimit('name')}
              </div>
              <div className="relative">
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  placeholder="e.g., Premium Hair Styling"
                  disabled={!canEditField('name') || savingFields['name']}
                  className="h-11 border-gray-300 focus-visible:ring-gray-900 pr-9"
                />
                {savingFields['name'] && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                    <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400">Give your service a clear and descriptive name</p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-description" className="text-sm font-medium text-gray-700">
                  Description <span className="text-red-500">*</span>
                </Label>
                {renderEditLimit('description')}
              </div>
              <div className="relative">
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  onBlur={() => handleBlur('description')}
                  placeholder="Describe your service in detail..."
                  disabled={!canEditField('description') || savingFields['description']}
                  className="min-h-[100px] border-gray-300 focus-visible:ring-gray-900"
                />
                {savingFields['description'] && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                    <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400">Include all important details to set clear expectations</p>
            </div>

            {/* Pricing */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pricing
              </h4>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">
                    Pricing Model <span className="text-red-500">*</span>
                  </Label>
                  {renderEditLimit('price_type')}
                </div>
                <RadioGroup
                  value={formData.price_type}
                  onValueChange={(value: 'fixed' | 'hourly') => {
                    handleChange('price_type', value);
                    setTimeout(() => handleBlur('price_type'), 0);
                  }}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="edit-fixed" disabled={!canEditField('price_type')} />
                    <Label htmlFor="edit-fixed" className="cursor-pointer text-sm font-medium">Minimum Amount</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hourly" id="edit-hourly" disabled={!canEditField('price_type')} />
                    <Label htmlFor="edit-hourly" className="cursor-pointer text-sm font-medium">Hourly Rate</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-price" className="text-sm font-medium text-gray-700">
                    {formData.price_type === 'hourly' ? 'Price per Hour' : 'Minimum Price'}{' '}
                    <span className="text-red-500">*</span>
                  </Label>
                  {renderEditLimit('price')}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => handleChange('price', e.target.value)}
                    onBlur={() => handleBlur('price')}
                    placeholder={formData.price_type === 'hourly' ? 'e.g., 75' : 'e.g., 50'}
                    disabled={!canEditField('price') || savingFields['price']}
                    className="pl-8 h-11 border-gray-300 focus-visible:ring-gray-900 pr-9"
                  />
                  {savingFields['price'] && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                      <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Duration
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-min-duration" className="text-sm font-medium text-gray-700">
                      Minimum Duration <span className="text-red-500">*</span>
                    </Label>
                    {renderEditLimit('min_duration')}
                  </div>
                  <div className="relative">
                    <Input
                      id="edit-min-duration"
                      type="number"
                      value={formData.min_duration}
                      onChange={(e) => handleChange('min_duration', e.target.value)}
                      onBlur={() => handleBlur('min_duration')}
                      placeholder="e.g., 30"
                      disabled={!canEditField('min_duration') || savingFields['min_duration']}
                      className="h-11 border-gray-300 focus-visible:ring-gray-900 pr-9"
                    />
                    {savingFields['min_duration'] && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                        <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-duration-unit" className="text-sm font-medium text-gray-700">
                      Unit <span className="text-red-500">*</span>
                    </Label>
                    {renderEditLimit('duration_unit')}
                  </div>
                  <Select
                    value={formData.duration_unit}
                    onValueChange={(value: any) => {
                      handleChange('duration_unit', value);
                      setTimeout(() => handleBlur('duration_unit'), 0);
                    }}
                    disabled={!canEditField('duration_unit')}
                  >
                    <SelectTrigger className="h-11 border-gray-300 focus-visible:ring-gray-900">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-gray-400">Minimum time required for this service</p>
            </div>

            {/* Preparation Time — toggle is ungated, number field is gated */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium text-gray-700">Preparation Time</Label>
                  <p className="text-xs text-gray-400">Does this service require preparation time?</p>
                </div>
                <Switch
                  checked={formData.has_preparation_time}
                  onCheckedChange={(value) => {
                    handleChange('has_preparation_time', value);
                    handleBlur('has_preparation_time');
                  }}
                  className="data-[state=checked]:bg-gray-900"
                />
              </div>

              {formData.has_preparation_time && (
                <div className="space-y-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-preparation-time" className="text-sm font-medium text-gray-700">
                      Preparation Time (minutes) <span className="text-red-500">*</span>
                    </Label>
                    {renderEditLimit('preparation_time')}
                  </div>
                  <div className="relative">
                    <Input
                      id="edit-preparation-time"
                      type="number"
                      value={formData.preparation_time}
                      onChange={(e) => handleChange('preparation_time', e.target.value)}
                      onBlur={() => handleBlur('preparation_time')}
                      placeholder="e.g., 15"
                      disabled={!canEditField('preparation_time') || savingFields['preparation_time']}
                      className="h-11 border-gray-300 focus-visible:ring-gray-900 pr-9"
                    />
                    {savingFields['preparation_time'] && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                        <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Time needed before the service can start</p>
                </div>
              )}
            </div>

            {/* Max Capacity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-max-capacity" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Max Capacity <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                {renderEditLimit('max_capacity')}
              </div>
              <div className="relative">
                <Input
                  id="edit-max-capacity"
                  type="number"
                  value={formData.max_capacity}
                  onChange={(e) => handleChange('max_capacity', e.target.value)}
                  onBlur={() => handleBlur('max_capacity')}
                  placeholder="e.g., 10"
                  disabled={!canEditField('max_capacity') || savingFields['max_capacity']}
                  className="h-11 border-gray-300 focus-visible:ring-gray-900 pr-9"
                />
                {savingFields['max_capacity'] && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                    <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400">Maximum number of people that can be accommodated</p>
            </div>

            {/* Policies */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-policies" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Policies <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                {renderEditLimit('policies')}
              </div>
              <div className="relative">
                <Textarea
                  id="edit-policies"
                  value={formData.policies}
                  onChange={(e) => handleChange('policies', e.target.value)}
                  onBlur={() => handleBlur('policies')}
                  placeholder="e.g., Cancellation policy, rescheduling terms..."
                  disabled={!canEditField('policies') || savingFields['policies']}
                  className="min-h-[80px] border-gray-300 focus-visible:ring-gray-900"
                />
                {savingFields['policies'] && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                    <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700">Service Image</Label>
                {renderEditLimit('image')}
              </div>
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
                    {canEditField('image') && (
                      <button
                        type="button"
                        onClick={removeImage}
                        disabled={savingFields['image']}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-md disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                      <Upload className="h-6 w-6 text-gray-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">Click to upload an image</p>
                    <p className="text-xs text-gray-400">SVG, PNG, JPG (max 5MB)</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  disabled={!canEditField('image') || savingFields['image']}
                />
                {savingFields['image'] && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Availability — ungated */}
            <div className="flex flex-row items-center justify-between rounded-lg border border-gray-200 p-4 bg-gray-50">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-gray-700">Available</Label>
                <p className="text-xs text-gray-400">Make this service available for booking</p>
              </div>
              <Switch
                checked={formData.is_available}
                onCheckedChange={(value) => {
                  handleChange('is_available', value);
                  handleBlur('is_available');
                }}
                className="data-[state=checked]:bg-gray-900"
              />
            </div>

            <SheetFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-11 border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </Button>
           
            </SheetFooter>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}