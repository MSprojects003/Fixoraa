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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, X, Package, DollarSign, Tag, FileText, Boxes, Loader2, Palette, Plus, Image as ImageIcon, AlertCircle, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HexColorPicker } from 'react-colorful';
import { getProductById, updateProduct, updateProductWithImages, UpdateProductData } from '@/lib/api/products';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import Link from 'next/link';

interface EditProductProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: string;
  vendorId?: string;
  onSuccess?: () => void;
}

const PREDEFINED_COLORS = [
  { name: 'Red', hex: '#FF0000' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Green', hex: '#008000' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Orange', hex: '#FFA500' },
  { name: 'Purple', hex: '#800080' },
  { name: 'Pink', hex: '#FFC0CB' },
  { name: 'Brown', hex: '#A52A2A' },
  { name: 'Gray', hex: '#808080' },
  { name: 'Gold', hex: '#FFD700' },
  { name: 'Silver', hex: '#C0C0C0' },
  { name: 'Navy', hex: '#000080' },
  { name: 'Teal', hex: '#008080' },
  { name: 'Maroon', hex: '#800000' },
];

// Fields tracked for per-product edit limits. Every limited text field in
// this form maps to one entry here. Image fields, toggles, and colors are
// intentionally left ungated for now — only ask for limits on these if you
// want them too, since each additional gated field is one more thing a
// vendor can run out of mid-edit.
const LIMITED_PRODUCT_FIELDS = [
  'name',
  'category',
  'description',
  'price',
  'sku',
  'barcode',
  'quantity',
  'weight',
  'weight_unit',
  'dimensions',
  'brand',
  'image_1',
  'image_2',
];

export function EditProduct({
  isOpen,
  onOpenChange,
  productId,
  vendorId,
  onSuccess,
}: EditProductProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imagePreview1, setImagePreview1] = useState<string | null>(null);
  const [imageFile1, setImageFile1] = useState<File | null>(null);
  const [imagePreview2, setImagePreview2] = useState<string | null>(null);
  const [imageFile2, setImageFile2] = useState<File | null>(null);
  const [showWeightDimensions, setShowWeightDimensions] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#000000');

  // Per-product, per-field edit tracking. Mirrors the vendor account-sheet
  // pattern exactly: planType/maxEdits come from get_product_edit_status,
  // counts reset automatically server-side when the vendor enters a new
  // billing period.
  const [planType, setPlanType] = useState<string>('basic');
  const [maxEdits, setMaxEdits] = useState<number | null>(2); // null = unlimited
  const [editCounts, setEditCounts] = useState<Record<string, number>>({});
  const [savingFields, setSavingFields] = useState<Record<string, boolean>>({});
  const [isCheckingLimits, setIsCheckingLimits] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    sku: '',
    barcode: '',
    quantity: '',
    weight: '',
    weight_unit: 'kg' as 'kg' | 'g' | 'lb' | 'oz',
    dimensions: '',
    is_available: true,
    is_featured: false,
    brand: '',
    colors: [] as string[],
  });

  // Baseline for "did this field actually change" comparisons on blur.
  // Same fix as the vendor account sheet: formData updates on every
  // keystroke via handleChange, so formData itself can't be the baseline —
  // comparing against it always reads as unchanged.
  const lastSavedRef = React.useRef<Record<string, string>>({});

  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId || !isOpen) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getProductById(productId);

        if (data) {
          const next = {
            name: data.name || '',
            category: data.category || '',
            description: data.description || '',
            price: data.price?.toString() || '',
            sku: data.sku || '',
            barcode: data.barcode || '',
            quantity: data.quantity?.toString() || '',
            weight: data.weight?.toString() || '',
            weight_unit: data.weight_unit || 'kg',
            dimensions: data.dimensions || '',
            is_available: data.is_available ?? true,
            is_featured: data.is_featured ?? false,
            brand: data.brand || '',
            colors: data.colors || [],
          };
          setFormData(next);
          lastSavedRef.current = {
            name: next.name,
            category: next.category,
            description: next.description,
            price: next.price,
            sku: next.sku,
            barcode: next.barcode,
            quantity: next.quantity,
            weight: next.weight,
            weight_unit: next.weight_unit,
            dimensions: next.dimensions,
            brand: next.brand,
          };
          setImagePreview1(data.image_url || null);
          setImagePreview2(data.image_url_2 || null);
          setShowWeightDimensions(!!data.weight || !!data.dimensions);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        toast.error('Failed to load product data');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, isOpen]);

  // Load the per-product edit-limit status whenever the sheet opens for a
  // given product. Authoritative from the database — plan_type, max_edits,
  // and current counts all come from get_product_edit_status, which also
  // applies the billing-period reset, so the client never has to duplicate
  // that logic.
  useEffect(() => {
    if (!productId || !vendorId || !isOpen) {
      console.log(`[product-limits] skipping check: productId="${productId}" vendorId="${vendorId}" isOpen=${isOpen}`);
      return;
    }

    let cancelled = false;
    setIsCheckingLimits(true);
    console.log(`[product-limits] checking for productId="${productId}" vendorId="${vendorId}"`);

    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_product_edit_status', {
          p_product_id: productId,
          p_vendor_id: vendorId,
        });

        console.log(`[product-limits] get_product_edit_status RAW response:`, { data, error });

        if (error) throw error;
        const row = data?.[0];

        if (cancelled) return;

        if (row) {
          console.log(`[product-limits] loaded: plan_type=${row.plan_type} max_edits=${row.max_edits} counts=`, row.counts);
          setPlanType(row.plan_type || 'basic');
          setMaxEdits(row.max_edits ?? null);
          setEditCounts((row.counts as Record<string, number>) || {});
        } else {
          console.warn('[product-limits] no row returned, defaulting to basic/2/empty');
          setPlanType('basic');
          setMaxEdits(2);
          setEditCounts({});
        }
      } catch (err) {
        console.error('[product-limits] RPC FAILED:', JSON.stringify(err, null, 2));
        if (!cancelled) {
          // Fail closed-ish: assume basic limits if we can't verify, and
          // reset counts too — leaving a stale editCounts from a
          // previously-opened product here would silently misapply that
          // product's limit state to this one.
          setPlanType('basic');
          setMaxEdits(2);
          setEditCounts({});
        }
      } finally {
        if (!cancelled) setIsCheckingLimits(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, vendorId, isOpen]);

  const isUnlimited = maxEdits === null;

  const canEditField = (field: string): boolean => {
    if (!LIMITED_PRODUCT_FIELDS.includes(field)) return true;
    if (isUnlimited) return true;
    const currentCount = editCounts[field] || 0;
    return currentCount < (maxEdits as number);
  };

  const getRemainingEdits = (field: string): number => {
    if (!LIMITED_PRODUCT_FIELDS.includes(field)) return Infinity;
    if (isUnlimited) return Infinity;
    const currentCount = editCounts[field] || 0;
    return Math.max(0, (maxEdits as number) - currentCount);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBlur = async (field: string) => {
    console.log(`[product-blur] field="${field}" productId="${productId}" vendorId="${vendorId}"`);

    if (!productId || !vendorId) {
      console.log(`[product-blur] ABORTING: productId or vendorId missing. productId="${productId}" vendorId="${vendorId}"`);
      return;
    }

    const value = formData[field as keyof typeof formData];

    // Only compare/gate fields that are actually tracked as strings here;
    // booleans/arrays (is_available, is_featured, colors) go straight
    // through without the limit check, matching their current ungated
    // behavior in this form.
    if (LIMITED_PRODUCT_FIELDS.includes(field)) {
      const baseline = lastSavedRef.current[field];
      console.log(`[product-blur] field="${field}" is limited. baseline="${baseline}" newValue="${value}"`);

      if (baseline === value) {
        console.log(`[product-blur] field="${field}" unchanged, skipping save entirely`);
        return; // genuinely unchanged, skip save + skip spending an edit
      }

      if (!canEditField(field)) {
        console.log(`[product-blur] field="${field}" BLOCKED by canEditField. editCounts=`, editCounts, `maxEdits=${maxEdits}`);
        toast.error(
          `You've reached the edit limit for this field (${maxEdits} per billing period). Upgrade your plan for more.`
        );
        return;
      }
    }

    try {
      setSaving(true);
      setSavingFields(prev => ({ ...prev, [field]: true }));

      const updateData: UpdateProductData = {};

      if (field === 'name') updateData.name = value as string;
      else if (field === 'category') updateData.category = value as string;
      else if (field === 'description') updateData.description = value as string;
      else if (field === 'price') updateData.price = parseFloat(value as string) || 0;
      else if (field === 'sku') updateData.sku = (value as string) || undefined;
      else if (field === 'barcode') updateData.barcode = (value as string) || undefined;
      else if (field === 'quantity') updateData.quantity = parseInt(value as string) || 0;
      else if (field === 'weight') updateData.weight = value ? parseFloat(value as string) : null;
      else if (field === 'weight_unit') updateData.weight_unit = value as 'kg' | 'g' | 'lb' | 'oz';
      else if (field === 'dimensions') updateData.dimensions = (value as string) || null;
      else if (field === 'is_available') updateData.is_available = value as boolean;
      else if (field === 'is_featured') updateData.is_featured = value as boolean;
      else if (field === 'brand') updateData.brand = (value as string) || null;
      else if (field === 'colors') updateData.colors = value as string[];

      console.log(`[product-blur] calling updateProduct(${productId}, ...)`, updateData);
      const result = await updateProduct(productId, updateData);
      console.log(`[product-blur] updateProduct result:`, result);

      if (result) {
        toast.success(`${field} updated successfully`);

        if (LIMITED_PRODUCT_FIELDS.includes(field)) {
          lastSavedRef.current[field] = value as string;

          console.log(`[product-blur] about to call record_product_field_edit with p_product_id="${productId}" p_vendor_id="${vendorId}" p_field="${field}"`);

          // Spend the edit credit only after the save is confirmed.
          try {
            const { data: updatedTracking, error: trackingError } = await supabase.rpc(
              'record_product_field_edit',
              { p_product_id: productId, p_vendor_id: vendorId, p_field: field }
            );

            console.log(`[product-blur] record_product_field_edit RAW response:`, { updatedTracking, trackingError });

            if (trackingError) {
              console.error(`[product-blur] record_product_field_edit RPC ERROR:`, JSON.stringify(trackingError, null, 2));
              throw trackingError;
            }

            const counts = (updatedTracking?.counts as Record<string, number>) || {};
            console.log(`[product-blur] SUCCESS, new counts:`, counts);
            setEditCounts(counts);
          } catch (trackingErr) {
            console.error('[product-blur] CAUGHT error recording edit count:', trackingErr);
            // Surface this instead of staying silent — a swallowed error here
            // is exactly what made this bug invisible before.
            toast.error('Field saved, but the edit counter failed to update. Check console for details.');
          }
        }
      } else {
        console.error('[product-blur] updateProduct returned null/falsy — save likely failed silently');
      }
    } catch (error) {
      console.error('[product-blur] Error updating field:', error);
      toast.error('Failed to update field');
    } finally {
      setSaving(false);
      setSavingFields(prev => ({ ...prev, [field]: false }));
    }
  };

  // Image upload/remove, gated by the same per-field edit limit as the
  // text fields. trackingField is 'image_1' or 'image_2'; stateField is
  // the matching local preview/file state ('1' or '2').
  const handleImageChange = async (
    slot: 1 | 2,
    file: File | null,
    isRemoval: boolean
  ) => {
    if (!productId || !vendorId) {
      console.log(`[product-image] ABORTING: productId or vendorId missing. productId="${productId}" vendorId="${vendorId}"`);
      return;
    }

    const trackingField = slot === 1 ? 'image_1' : 'image_2';

    if (!canEditField(trackingField)) {
      toast.error(
        `You've reached the edit limit for images (${maxEdits} per billing period). Upgrade your plan for more.`
      );
      return;
    }

    const savingKey = trackingField;
    setSavingFields(prev => ({ ...prev, [savingKey]: true }));

    try {
      const result = await updateProductWithImages(
        productId,
        {},
        slot === 1 ? file : undefined,
        slot === 2 ? file : undefined,
        slot === 1 ? isRemoval : undefined,
        slot === 2 ? isRemoval : undefined
      );

      if (!result) {
        throw new Error('Image update returned no result');
      }

      if (slot === 1) {
        setImagePreview1(result.image_url || null);
        setImageFile1(null);
      } else {
        setImagePreview2(result.image_url_2 || null);
        setImageFile2(null);
      }

      toast.success(isRemoval ? 'Image removed' : 'Image updated successfully');

      // Spend the edit credit only after the save is confirmed, same as
      // every text field.
      try {
        const { data: updatedTracking, error: trackingError } = await supabase.rpc(
          'record_product_field_edit',
          { p_product_id: productId, p_vendor_id: vendorId, p_field: trackingField }
        );
        if (trackingError) throw trackingError;

        const counts = (updatedTracking?.counts as Record<string, number>) || {};
        setEditCounts(counts);
      } catch (trackingErr) {
        console.error('[product-image] Saved image but failed to record edit count:', trackingErr);
        toast.error('Image saved, but the edit counter failed to update.');
      }
    } catch (error) {
      console.error('[product-image] Error updating image:', error);
      toast.error('Failed to update image');
    } finally {
      setSavingFields(prev => ({ ...prev, [savingKey]: false }));
    }
  };

  const handleImageUpload1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Show an instant local preview while the upload is in flight.
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview1(reader.result as string);
    reader.readAsDataURL(file);
    setImageFile1(file);

    handleImageChange(1, file, false);
  };

  const handleImageUpload2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview2(reader.result as string);
    reader.readAsDataURL(file);
    setImageFile2(file);

    handleImageChange(2, file, false);
  };

  const removeImage1 = () => {
    if (!canEditField('image_1')) {
      toast.error(`You've reached the edit limit for images (${maxEdits} per billing period). Upgrade your plan for more.`);
      return;
    }
    handleImageChange(1, null, true);
  };

  const removeImage2 = () => {
    if (!canEditField('image_2')) {
      toast.error(`You've reached the edit limit for images (${maxEdits} per billing period). Upgrade your plan for more.`);
      return;
    }
    handleImageChange(2, null, true);
  };

  const toggleColor = (hex: string) => {
    setFormData(prev => {
      const colors = prev.colors.includes(hex)
        ? prev.colors.filter(c => c !== hex)
        : [...prev.colors, hex];
      return { ...prev, colors };
    });
    // Auto-save colors
    if (productId) {
      setTimeout(() => handleBlur('colors'), 100);
    }
  };

  const addCustomColor = () => {
    if (!selectedColor) {
      toast.error('Please select a color first');
      return;
    }

    if (formData.colors.includes(selectedColor)) {
      toast.error('This color is already added');
      return;
    }

    setFormData(prev => ({
      ...prev,
      colors: [...prev.colors, selectedColor]
    }));
    setColorPickerOpen(false);
    toast.success('Color added successfully');

    if (productId) {
      setTimeout(() => handleBlur('colors'), 100);
    }
  };

  const removeCustomColor = (hex: string) => {
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.filter(c => c !== hex)
    }));
    if (productId) {
      setTimeout(() => handleBlur('colors'), 100);
    }
  };

  const getColorName = (hex: string) => {
    const found = PREDEFINED_COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase());
    return found ? found.name : hex;
  };

  const chunkArray = (arr: any[], size: number) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  };

  const colorRows = chunkArray(PREDEFINED_COLORS, 3);

  // Small inline indicator shown next to a field's label: remaining
  // edits, or an "Unlimited" badge for premium, or a "Limit reached" +
  // upgrade link once exhausted.
  const renderEditLimit = (field: string) => {
    if (!LIMITED_PRODUCT_FIELDS.includes(field)) return null;
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

  if (loading) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
          {/* SheetContent renders a Radix Dialog under the hood, which requires a
              DialogTitle for every state it can be in (including this loading
              state) to stay accessible to screen readers. We keep the visual
              design unchanged by visually hiding the title here. */}
          <VisuallyHidden asChild>
            <SheetTitle>Loading product</SheetTitle>
          </VisuallyHidden>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="text-sm text-gray-500">Loading product data...</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 bg-white">
        <div className="p-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-700" />
              Edit Product
              {saving && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </SheetTitle>
            <SheetDescription className="text-sm text-gray-500">
              Update your product details. Changes are saved automatically on blur.
            </SheetDescription>
            {!isCheckingLimits && !isUnlimited && (
              <p className="text-xs text-gray-400">
                {planType.charAt(0).toUpperCase() + planType.slice(1)} plan — {maxEdits} edits per field, per billing period
              </p>
            )}
          </SheetHeader>

          <div className="space-y-6">
            {/* Product Name */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700">
                  Product Name <span className="text-red-500">*</span>
                </Label>
                {renderEditLimit('name')}
              </div>
              <div className="relative">
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  disabled={!canEditField('name') || savingFields['name']}
                  className="h-11 border-gray-300 focus-visible:ring-gray-900 pr-9"
                />
                {savingFields['name'] && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                    <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-category" className="text-sm font-medium text-gray-700">
                  Category <span className="text-red-500">*</span>
                </Label>
                {renderEditLimit('category')}
              </div>
              <div className="relative">
                <Input
                  id="edit-category"
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  onBlur={() => handleBlur('category')}
                  disabled={!canEditField('category') || savingFields['category']}
                  className="h-11 border-gray-300 focus-visible:ring-gray-900 pr-9"
                />
                {savingFields['category'] && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                    <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-description" className="text-sm font-medium text-gray-700">
                  Description
                </Label>
                {renderEditLimit('description')}
              </div>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                onBlur={() => handleBlur('description')}
                disabled={!canEditField('description') || savingFields['description']}
                className="min-h-[100px] border-gray-300 focus-visible:ring-gray-900"
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-price" className="text-sm font-medium text-gray-700">
                  Price <span className="text-red-500">*</span>
                </Label>
                {renderEditLimit('price')}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">Rs.</span>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => handleChange('price', e.target.value)}
                  onBlur={() => handleBlur('price')}
                  disabled={!canEditField('price') || savingFields['price']}
                  className="pl-11 h-11 border-gray-300 focus-visible:ring-gray-900"
                />
              </div>
            </div>

            {/* Brand */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-brand" className="text-sm font-medium text-gray-700">
                  Brand <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                {renderEditLimit('brand')}
              </div>
              <Input
                id="edit-brand"
                value={formData.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                onBlur={() => handleBlur('brand')}
                disabled={!canEditField('brand') || savingFields['brand']}
                className="h-11 border-gray-300 focus-visible:ring-gray-900"
              />
            </div>

            {/* Product Images */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5" />
                Product Images
              </h4>

              {/* Image 1 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">
                    Image 1 <span className="text-red-500">*</span>
                  </Label>
                  {renderEditLimit('image_1')}
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center relative transition-colors hover:border-gray-300">
                  {imagePreview1 ? (
                    <div className="relative inline-block">
                      <img
                        src={imagePreview1}
                        alt="Product preview 1"
                        className="max-h-48 rounded-lg object-contain"
                      />
                      {canEditField('image_1') && (
                        <button
                          type="button"
                          onClick={removeImage1}
                          disabled={savingFields['image_1']}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-11 h-11 mx-auto bg-gray-50 rounded-full flex items-center justify-center">
                        <Upload className="h-5 w-5 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-600">Click to upload main image</p>
                      <p className="text-xs text-gray-400">SVG, PNG, JPG (max 5MB)</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload1}
                    disabled={!canEditField('image_1') || savingFields['image_1']}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  {savingFields['image_1'] && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                    </div>
                  )}
                </div>
              </div>

              {/* Image 2 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">
                    Image 2 <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  {renderEditLimit('image_2')}
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center relative transition-colors hover:border-gray-300">
                  {imagePreview2 ? (
                    <div className="relative inline-block">
                      <img
                        src={imagePreview2}
                        alt="Product preview 2"
                        className="max-h-48 rounded-lg object-contain"
                      />
                      {canEditField('image_2') && (
                        <button
                          type="button"
                          onClick={removeImage2}
                          disabled={savingFields['image_2']}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-11 h-11 mx-auto bg-gray-50 rounded-full flex items-center justify-center">
                        <Upload className="h-5 w-5 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-600">Click to upload additional image</p>
                      <p className="text-xs text-gray-400">SVG, PNG, JPG (max 5MB)</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload2}
                    disabled={!canEditField('image_2') || savingFields['image_2']}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  {savingFields['image_2'] && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Colors — ungated, same as before */}
            <div className="space-y-4">
              <Label className="text-sm font-medium text-gray-700">Available Colors</Label>

              <div className="space-y-2">
                {colorRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-3 gap-2">
                    {row.map((color) => (
                      <div key={color.hex} className="flex items-center gap-2">
                        <Checkbox
                          id={`edit-color-${color.hex}`}
                          checked={formData.colors.includes(color.hex)}
                          onCheckedChange={() => toggleColor(color.hex)}
                          className="data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900"
                        />
                        <div
                          className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                        <Label
                          htmlFor={`edit-color-${color.hex}`}
                          className="text-xs text-gray-600 cursor-pointer"
                        >
                          {color.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Custom Color */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 px-3 border-gray-300">
                      <div
                        className="w-5 h-5 rounded-full border border-gray-300 mr-2"
                        style={{ backgroundColor: selectedColor }}
                      />
                      Pick a color
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-none shadow-lg">
                    <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-200">
                      <HexColorPicker color={selectedColor} onChange={setSelectedColor} />
                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={addCustomColor}
                          className="flex-1 h-9 bg-black hover:bg-gray-800 text-white"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Color
                        </Button>
                        <Button variant="outline" onClick={() => setColorPickerOpen(false)} className="h-9">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="flex-1">
                  <Input
                    placeholder="#FFFFFF"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="h-9 text-sm font-mono border-gray-300 focus-visible:ring-gray-900"
                  />
                </div>
              </div>

              {/* Selected Colors */}
              {formData.colors.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs font-medium text-gray-500 mr-1">Selected:</span>
                  {formData.colors.map((hex) => (
                    <Badge key={hex} variant="outline" className="flex items-center gap-1.5 px-2.5 py-1 text-xs">
                      <span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: hex }} />
                      {getColorName(hex)}
                      <button onClick={() => removeCustomColor(hex)} className="hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Inventory */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inventory</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-sku" className="text-sm font-medium text-gray-700">
                      SKU <span className="text-gray-400 font-normal">(optional)</span>
                    </Label>
                  </div>
                  <Input
                    id="edit-sku"
                    value={formData.sku}
                    onChange={(e) => handleChange('sku', e.target.value)}
                    onBlur={() => handleBlur('sku')}
                    disabled={!canEditField('sku') || savingFields['sku']}
                    className="h-11 border-gray-300 focus-visible:ring-gray-900"
                  />
                  {renderEditLimit('sku')}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-quantity" className="text-sm font-medium text-gray-700">
                    Quantity <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => handleChange('quantity', e.target.value)}
                    onBlur={() => handleBlur('quantity')}
                    disabled={!canEditField('quantity') || savingFields['quantity']}
                    className="h-11 border-gray-300 focus-visible:ring-gray-900"
                  />
                  {renderEditLimit('quantity')}
                </div>
              </div>
            </div>

            {/* Weight & Dimensions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Weight & Dimensions</Label>
                  <p className="text-xs text-gray-400">Add shipping details</p>
                </div>
                <Switch
                  checked={showWeightDimensions}
                  onCheckedChange={setShowWeightDimensions}
                  className="data-[state=checked]:bg-gray-900"
                />
              </div>

              {showWeightDimensions && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="edit-weight" className="text-sm font-medium text-gray-700">Weight</Label>
                        {renderEditLimit('weight')}
                      </div>
                      <Input
                        id="edit-weight"
                        type="number"
                        step="0.01"
                        value={formData.weight}
                        onChange={(e) => handleChange('weight', e.target.value)}
                        onBlur={() => handleBlur('weight')}
                        disabled={!canEditField('weight') || savingFields['weight']}
                        className="h-11 border-gray-300 focus-visible:ring-gray-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-weight-unit" className="text-sm font-medium text-gray-700">Unit</Label>
                      <Select
                        value={formData.weight_unit}
                        onValueChange={(value: 'kg' | 'g' | 'lb' | 'oz') => {
                          handleChange('weight_unit', value);
                          handleBlur('weight_unit');
                        }}
                        disabled={!canEditField('weight_unit')}
                      >
                        <SelectTrigger className="h-11 border-gray-300 focus-visible:ring-gray-900">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="lb">lb</SelectItem>
                          <SelectItem value="oz">oz</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="edit-dimensions" className="text-sm font-medium text-gray-700">
                        Dimensions <span className="text-gray-400 font-normal">(optional)</span>
                      </Label>
                      {renderEditLimit('dimensions')}
                    </div>
                    <Input
                      id="edit-dimensions"
                      value={formData.dimensions}
                      onChange={(e) => handleChange('dimensions', e.target.value)}
                      onBlur={() => handleBlur('dimensions')}
                      disabled={!canEditField('dimensions') || savingFields['dimensions']}
                      className="h-11 border-gray-300 focus-visible:ring-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Toggles — ungated, same as before */}
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 bg-gray-50">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Available</Label>
                  <p className="text-xs text-gray-400">Make this product available</p>
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
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 bg-gray-50">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Featured</Label>
                  <p className="text-xs text-gray-400">Feature on storefront</p>
                </div>
                <Switch
                  checked={formData.is_featured}
                  onCheckedChange={(value) => {
                    handleChange('is_featured', value);
                    handleBlur('is_featured');
                  }}
                  className="data-[state=checked]:bg-gray-900"
                />
              </div>
            </div>

            {/* Footer */}
            <SheetFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-11 border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                className="flex-1 h-11 bg-black hover:bg-gray-800 text-white"
              >
                Done
              </Button>
            </SheetFooter>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}