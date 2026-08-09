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
import { createProductWithImages, CreateProductData } from '@/lib/api/products';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface AddProductsProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId?: string;
  vendorCategory?: string;
  onSuccess?: () => void;
}

// Predefined colors with hex values
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

// All product categories, grouped by business type
const PRODUCT_CATEGORY_GROUPS: { group: string; items: { value: string; label: string }[] }[] = [
  {
    group: 'Salon',
    items: [
      { value: 'hair_care', label: 'Hair Care' },
      { value: 'hair_creams', label: 'Hair Creams & Oils' },
      { value: 'skin_care', label: 'Skin Care' },
      { value: 'nail_care', label: 'Nail Care' },
      { value: 'cosmetics', label: 'Cosmetics & Makeup' },
      { value: 'hair_tools', label: 'Hair Styling Tools' },
      { value: 'beauty_accessories', label: 'Beauty Accessories' },
      { value: 'professional_salon_products', label: 'Professional Salon Products' },
    ],
  },
  {
    group: 'Technician',
    items: [
      { value: 'hand_tools', label: 'Hand Tools' },
      { value: 'power_tools', label: 'Power Tools' },
      { value: 'spare_parts', label: 'Spare Parts' },
      { value: 'consumables', label: 'Consumables' },
      { value: 'measuring_tools', label: 'Measuring Tools' },
      { value: 'repair_kits', label: 'Repair Kits' },
      { value: 'technician_safety_gear', label: 'Safety Gear' },
    ],
  },
  {
    group: 'Electrician',
    items: [
      { value: 'wires_cables', label: 'Wires & Cables' },
      { value: 'switches_sockets', label: 'Switches & Sockets' },
      { value: 'circuit_breakers', label: 'Circuit Breakers & Fuses' },
      { value: 'lighting', label: 'Lighting & Lamps' },
      { value: 'electrical_tools', label: 'Electrical Tools' },
      { value: 'smart_devices', label: 'Smart Devices' },
      { value: 'electrical_safety_equipment', label: 'Electrical Safety Equipment' },
    ],
  },
  {
    group: 'Welding',
    items: [
      { value: 'welding_rods', label: 'Welding Rods & Bars' },
      { value: 'welding_electrodes', label: 'Welding Electrodes' },
      { value: 'welding_machines', label: 'Welding Machines' },
      { value: 'welding_gas', label: 'Welding Gas' },
      { value: 'metal_sheets', label: 'Metal Sheets & Bars' },
      { value: 'welding_accessories', label: 'Welding Accessories' },
      { value: 'welding_safety_gear', label: 'Welding Safety Gear' },
    ],
  },
  {
    group: 'Interior Design',
    items: [
      { value: 'furniture', label: 'Furniture' },
      { value: 'lighting_decor', label: 'Lighting & Decor' },
      { value: 'wall_coverings', label: 'Wall Coverings & Paint' },
      { value: 'flooring', label: 'Flooring Materials' },
      { value: 'curtains_blinds', label: 'Curtains & Blinds' },
      { value: 'rugs_carpets', label: 'Rugs & Carpets' },
      { value: 'decor_accessories', label: 'Decorative Accessories' },
    ],
  },
  {
    group: 'Bridal',
    items: [
      { value: 'bridal_gowns', label: 'Bridal Gowns' },
      { value: 'jewelry', label: 'Jewelry' },
      { value: 'veils_headpieces', label: 'Veils & Headpieces' },
      { value: 'bridal_shoes', label: 'Bridal Shoes' },
      { value: 'bridal_makeup', label: 'Bridal Makeup' },
      { value: 'bridal_accessories', label: 'Bridal Accessories' },
      { value: 'wedding_packages', label: 'Wedding Packages' },
    ],
  },
  {
    group: 'Architectural',
    items: [
      { value: 'blueprints', label: 'Blueprints & Plans' },
      { value: 'drafting_supplies', label: 'Drafting Supplies' },
      { value: 'modeling_tools', label: '3D Modeling Tools' },
      { value: 'architectural_software', label: 'Architectural Software' },
      { value: 'reference_materials', label: 'Reference Materials' },
      { value: 'presentation_tools', label: 'Presentation Tools' },
    ],
  },
  {
    group: 'Garden Cleaning',
    items: [
      { value: 'garden_tools', label: 'Garden Tools' },
      { value: 'cleaning_tools', label: 'Cleaning Tools' },
      { value: 'plants_seeds', label: 'Plants & Seeds' },
      { value: 'fertilizers', label: 'Fertilizers & Soil' },
      { value: 'pest_control', label: 'Pest Control Products' },
      { value: 'watering_equipment', label: 'Watering Equipment' },
      { value: 'outdoor_furniture', label: 'Outdoor Furniture' },
    ],
  },
  {
    group: 'Home Decorator',
    items: [
      { value: 'wall_decor', label: 'Wall Decor' },
      { value: 'vases_pots', label: 'Vases & Pots' },
      { value: 'cushions_throws', label: 'Cushions & Throws' },
      { value: 'tableware', label: 'Tableware' },
      { value: 'home_fragrance', label: 'Home Fragrance' },
      { value: 'home_accessories', label: 'Home Accessories' },
      { value: 'decorative_items', label: 'Decorative Items' },
    ],
  },
  {
    group: 'Catering',
    items: [
      { value: 'food_ingredients', label: 'Food Ingredients' },
      { value: 'catering_equipment', label: 'Catering Equipment' },
      { value: 'kitchen_tools', label: 'Kitchen Tools' },
      { value: 'serving_ware', label: 'Serving Ware' },
      { value: 'beverage_supplies', label: 'Beverage Supplies' },
      { value: 'food_packaging', label: 'Food Packaging' },
      { value: 'catering_packages', label: 'Catering Packages' },
    ],
  },
  {
    group: 'Garbage Disposal',
    items: [
      { value: 'disposal_bins', label: 'Disposal Bins' },
      { value: 'waste_bags', label: 'Waste Bags' },
      { value: 'recycling_equipment', label: 'Recycling Equipment' },
      { value: 'composting', label: 'Composting Products' },
      { value: 'disposal_cleaning_supplies', label: 'Cleaning Supplies' },
      { value: 'disposal_safety_gear', label: 'Safety Gear' },
    ],
  },
  {
    group: 'General',
    items: [
      { value: 'general', label: 'General Products' },
      { value: 'general_accessories', label: 'Accessories' },
      { value: 'general_tools', label: 'Tools' },
      { value: 'general_supplies', label: 'Supplies' },
    ],
  },
];

export function AddProducts({
  isOpen,
  onOpenChange,
  vendorId,
  vendorCategory,
  onSuccess,
}: AddProductsProps) {
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview1, setImagePreview1] = useState<string | null>(null);
  const [imageFile1, setImageFile1] = useState<File | null>(null);
  const [imagePreview2, setImagePreview2] = useState<string | null>(null);
  const [imageFile2, setImageFile2] = useState<File | null>(null);
  const [showWeightDimensions, setShowWeightDimensions] = useState(false);
  const [showBrand, setShowBrand] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#000000');

  // Product creation limit state, checked live against the database
  // (check_product_creation_allowed) rather than computed client-side, so
  // it stays correct across billing-period resets and plan changes.
  const [creationStatus, setCreationStatus] = useState<{
    allowed: boolean;
    currentCount: number;
    maxCount: number | null; // null = unlimited
  } | null>(null);
  const [isCheckingCreationLimit, setIsCheckingCreationLimit] = useState(true);

  // Form state
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

  // Check the creation limit whenever the sheet opens (not just on mount),
  // so re-opening after adding a product reflects the new count without
  // needing a full page reload.
  useEffect(() => {
    if (!isOpen || !vendorId) {
      return;
    }

    let cancelled = false;
    setIsCheckingCreationLimit(true);

    (async () => {
      try {
        const { data, error } = await supabase.rpc('check_product_creation_allowed', {
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
          // Fail closed if we can't determine the limit.
          setCreationStatus({ allowed: false, currentCount: 0, maxCount: 2 });
        }
      } catch (err) {
        console.error('Error checking product creation limit:', err);
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

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Image 1 handlers
  const handleImageUpload1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setImageFile1(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview1(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage1 = () => {
    setImageFile1(null);
    setImagePreview1(null);
  };

  // Image 2 handlers
  const handleImageUpload2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setImageFile2(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview2(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage2 = () => {
    setImageFile2(null);
    setImagePreview2(null);
  };

  // Color handling
  const toggleColor = (hex: string) => {
    setFormData(prev => {
      const colors = prev.colors.includes(hex)
        ? prev.colors.filter(c => c !== hex)
        : [...prev.colors, hex];
      return { ...prev, colors };
    });
  };

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
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
  };

  const removeCustomColor = (hex: string) => {
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.filter(c => c !== hex)
    }));
  };

  const onSubmit = async () => {
    // Validate required fields
    if (!formData.name) {
      toast.error('Please enter a product name');
      return;
    }
    if (!formData.category) {
      toast.error('Please select a category');
      return;
    }
    if (!formData.price) {
      toast.error('Please enter a price');
      return;
    }
    if (!vendorId) {
      toast.error('Vendor ID not found');
      return;
    }

    // Re-check the limit right before submitting, not just on sheet open —
    // closes the gap where someone leaves the sheet open across a billing
    // boundary, or adds a product in another tab.
    if (creationStatus && !creationStatus.allowed) {
      toast.error('You have reached your product limit for this billing period. Upgrade your plan to add more.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare product data
      const productData: CreateProductData = {
        vendor_id: vendorId,
        name: formData.name,
        category: formData.category || vendorCategory || 'general',
        description: formData.description || undefined,
        price: parseFloat(formData.price),
        sku: formData.sku || undefined,
        barcode: formData.barcode || undefined,
        quantity: formData.quantity ? parseInt(formData.quantity) : 0,
        weight: showWeightDimensions && formData.weight ? parseFloat(formData.weight) : null,
        weight_unit: showWeightDimensions ? formData.weight_unit : null,
        dimensions: showWeightDimensions && formData.dimensions ? formData.dimensions : null,
        is_available: formData.is_available,
        is_featured: formData.is_featured,
        brand: showBrand && formData.brand ? formData.brand : null,
        colors: formData.colors.length > 0 ? formData.colors : null,
      };

      // Use the API function with image upload support
      const result = await createProductWithImages(
        productData,
        imageFile1,
        imageFile2
      );

      if (!result) {
        throw new Error('Failed to create product');
      }

      // Only record the creation against the limit AFTER the product was
      // actually created successfully — never spend the count on a failed
      // attempt.
      try {
        const { data: updatedTracking, error: trackingError } = await supabase.rpc(
          'record_product_creation',
          { p_vendor_id: vendorId }
        );
        if (trackingError) throw trackingError;

        const newCount = (updatedTracking?.counts?.addproduct as number) ?? creationStatus?.currentCount ?? 0;
        setCreationStatus(prev => prev ? { ...prev, currentCount: newCount, allowed: prev.maxCount === null || newCount < prev.maxCount } : prev);
      } catch (trackingErr) {
        // The product itself was created successfully — a failure to record
        // the counter shouldn't block the user or roll back the product.
        // Log it so it can be investigated, but don't surface it as an error.
        console.error('Product was created but failed to record creation count:', trackingErr);
      }

      toast.success('Product added successfully!');
      onSuccess?.();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating product:', error);
      toast.error(error.message || 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      description: '',
      price: '',
      sku: '',
      barcode: '',
      quantity: '',
      weight: '',
      weight_unit: 'kg',
      dimensions: '',
      is_available: true,
      is_featured: false,
      brand: '',
      colors: [],
    });
    setImagePreview1(null);
    setImageFile1(null);
    setImagePreview2(null);
    setImageFile2(null);
    setShowWeightDimensions(false);
    setShowBrand(false);
    setSelectedColor('#000000');
  };

  // Get color name from hex
  const getColorName = (hex: string) => {
    const found = PREDEFINED_COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase());
    return found ? found.name : hex;
  };

  // Chunk array into rows of 3
  const chunkArray = (arr: any[], size: number) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  };

  const colorRows = chunkArray(PREDEFINED_COLORS, 3);

  const limitReached = !isCheckingCreationLimit && creationStatus && !creationStatus.allowed;
  const isFormDisabled = isSubmitting || !!limitReached;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 bg-white">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-5">
          <SheetTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2.5 leading-tight">
            <Package className="h-5 w-5 text-gray-700" />
            Add New Product
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            Fill in the details below to add a new product to your inventory.
            {vendorCategory && (
              <span className="block mt-1.5 text-xs text-gray-400">
                Business category:{' '}
                <span className="font-medium text-gray-700 capitalize">
                  {vendorCategory.replace(/_/g, ' ')}
                </span>
              </span>
            )}
          </SheetDescription>
          {!isCheckingCreationLimit && creationStatus && creationStatus.maxCount !== null && (
            <p className="text-xs text-gray-400 mt-2">
              {creationStatus.currentCount} of {creationStatus.maxCount} products used this period
            </p>
          )}
        </div>

        {/* Limit reached banner */}
        {limitReached && (
          <div className="flex items-center gap-2 px-6 py-3 bg-red-50 border-b border-red-200">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <p className="text-xs text-red-700 flex-1">
              You've used all {creationStatus?.maxCount} product slots for this billing period.{' '}
              <Link href="/subscription" className="underline font-semibold hover:text-red-900">
                Upgrade to add more
              </Link>
            </p>
          </div>
        )}

        <div className="px-6 py-6" aria-disabled={isFormDisabled}>
          <div className={`space-y-7 ${isFormDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Product Name */}
            <div className="space-y-2">
              <Label htmlFor="product-name" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-gray-400" />
                Product Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="product-name"
                placeholder="e.g., Premium Shampoo, Welding Rod 3.2mm"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={isFormDisabled}
                className="h-11 border-gray-300 focus-visible:ring-gray-900"
              />
              <p className="text-xs text-gray-400 leading-relaxed">Give your product a clear and descriptive name</p>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="product-category" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-gray-400" />
                Product Category <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleChange('category', value)}
                disabled={isFormDisabled}
              >
                <SelectTrigger className="h-11 border-gray-300 focus-visible:ring-gray-900">
                  <SelectValue placeholder="Select a product category" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {PRODUCT_CATEGORY_GROUPS.map((group) => (
                    <SelectGroup key={group.group}>
                      <SelectLabel className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {group.group}
                      </SelectLabel>
                      {group.items.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400 leading-relaxed">
                Categories are grouped by business type — pick the one that fits your product
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="product-description" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-gray-400" />
                Description
              </Label>
              <Textarea
                id="product-description"
                placeholder="Describe your product in detail — features, benefits, usage..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                disabled={isFormDisabled}
                className="min-h-[100px] border-gray-300 focus-visible:ring-gray-900"
              />
              <p className="text-xs text-gray-400 leading-relaxed">Include all important details about the product</p>
            </div>

            {/* Pricing */}
            <div className="pt-6 border-t border-gray-100 space-y-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5" />
                Pricing
              </h4>

              <div className="space-y-2">
                <Label htmlFor="product-price" className="text-sm font-medium text-gray-700">
                  Price <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                    Rs.
                  </span>
                  <Input
                    id="product-price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => handleChange('price', e.target.value)}
                    disabled={isFormDisabled}
                    className="pl-11 h-11 border-gray-300 focus-visible:ring-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Colors Section */}
            <div className="pt-6 border-t border-gray-100 space-y-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Palette className="h-3.5 w-3.5" />
                Available Colors
              </h4>

              {/* Predefined Color Checkboxes - 3 per row */}
              <div className="space-y-2">
                {colorRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-3 gap-2">
                    {row.map((color) => (
                      <div key={color.hex} className="flex items-center gap-2">
                        <Checkbox
                          id={`color-${color.hex}`}
                          checked={formData.colors.includes(color.hex)}
                          onCheckedChange={() => toggleColor(color.hex)}
                          disabled={isFormDisabled}
                          className="data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900"
                        />
                        <div
                          className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                        <Label
                          htmlFor={`color-${color.hex}`}
                          className="text-xs text-gray-600 cursor-pointer"
                        >
                          {color.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Color Picker - Custom Color */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isFormDisabled}
                      className="h-9 px-3 border-gray-300"
                    >
                      <div
                        className="w-5 h-5 rounded-full border border-gray-300 mr-2"
                        style={{ backgroundColor: selectedColor }}
                      />
                      Pick a color
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-none shadow-lg" align="start">
                    <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-200">
                      <HexColorPicker
                        color={selectedColor}
                        onChange={handleColorChange}
                      />
                      <div className="flex gap-2 mt-3">
                        <Button
                          type="button"
                          onClick={addCustomColor}
                          className="flex-1 h-9 bg-black hover:bg-gray-800 text-white"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Color
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setColorPickerOpen(false)}
                          className="h-9"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1">
                  <Input
                    placeholder="#FFFFFF"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    disabled={isFormDisabled}
                    className="h-9 text-sm font-mono border-gray-300 focus-visible:ring-gray-900"
                  />
                </div>
              </div>

              {/* Selected Colors Display */}
              {formData.colors.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs font-medium text-gray-500 mr-1">Selected:</span>
                  {formData.colors.map((hex) => (
                    <Badge
                      key={hex}
                      variant="outline"
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs"
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-gray-200"
                        style={{ backgroundColor: hex }}
                      />
                      {getColorName(hex)}
                      <button
                        type="button"
                        onClick={() => removeCustomColor(hex)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Brand Switch */}
            <div className="pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Brand</Label>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">Add brand information for this product</p>
                </div>
                <Switch
                  checked={showBrand}
                  onCheckedChange={setShowBrand}
                  disabled={isFormDisabled}
                  className="data-[state=checked]:bg-gray-900"
                />
              </div>

              {showBrand && (
                <div className="space-y-2 pt-4 mt-4 border-t border-gray-100">
                  <Label htmlFor="brand" className="text-sm font-medium text-gray-700">
                    Brand Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="brand"
                    placeholder="e.g., Nike, Apple, L'Oréal"
                    value={formData.brand}
                    onChange={(e) => handleChange('brand', e.target.value)}
                    disabled={isFormDisabled}
                    className="h-11 border-gray-300 focus-visible:ring-gray-900"
                  />
                  <p className="text-xs text-gray-400 leading-relaxed">Enter the brand name of this product</p>
                </div>
              )}
            </div>

            {/* Inventory */}
            <div className="pt-6 border-t border-gray-100 space-y-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Boxes className="h-3.5 w-3.5" />
                Inventory
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku" className="text-sm font-medium text-gray-700">
                    SKU <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="sku"
                    placeholder="e.g., SKU-001"
                    value={formData.sku}
                    onChange={(e) => handleChange('sku', e.target.value)}
                    disabled={isFormDisabled}
                    className="h-11 border-gray-300 focus-visible:ring-gray-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-sm font-medium text-gray-700">
                    Quantity <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    placeholder="0"
                    value={formData.quantity}
                    onChange={(e) => handleChange('quantity', e.target.value)}
                    disabled={isFormDisabled}
                    className="h-11 border-gray-300 focus-visible:ring-gray-900"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcode" className="text-sm font-medium text-gray-700">
                  Barcode <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                <Input
                  id="barcode"
                  placeholder="e.g., 123456789"
                  value={formData.barcode}
                  onChange={(e) => handleChange('barcode', e.target.value)}
                  disabled={isFormDisabled}
                  className="h-11 border-gray-300 focus-visible:ring-gray-900"
                />
              </div>
            </div>

            {/* Weight & Dimensions - Toggle Section */}
            <div className="pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Weight & Dimensions</Label>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">Add shipping details for this product</p>
                </div>
                <Switch
                  checked={showWeightDimensions}
                  onCheckedChange={setShowWeightDimensions}
                  disabled={isFormDisabled}
                  className="data-[state=checked]:bg-gray-900"
                />
              </div>

              {showWeightDimensions && (
                <div className="space-y-4 pt-5 mt-5 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="weight" className="text-sm font-medium text-gray-700">
                        Weight
                      </Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.weight}
                        onChange={(e) => handleChange('weight', e.target.value)}
                        disabled={isFormDisabled}
                        className="h-11 border-gray-300 focus-visible:ring-gray-900"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="weight-unit" className="text-sm font-medium text-gray-700">
                        Weight Unit
                      </Label>
                      <Select
                        value={formData.weight_unit}
                        onValueChange={(value) => handleChange('weight_unit', value)}
                        disabled={isFormDisabled}
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
                    <Label htmlFor="dimensions" className="text-sm font-medium text-gray-700">
                      Dimensions <span className="text-gray-400 font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="dimensions"
                      placeholder="e.g., 10 x 5 x 3 cm"
                      value={formData.dimensions}
                      onChange={(e) => handleChange('dimensions', e.target.value)}
                      disabled={isFormDisabled}
                      className="h-11 border-gray-300 focus-visible:ring-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Image Upload - Two Images */}
            <div className="pt-6 border-t border-gray-100 space-y-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5" />
                Product Images
              </h4>

              {/* Image 1 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Image 1 <span className="text-red-500">*</span>
                </Label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center relative transition-colors hover:border-gray-300">
                  {imagePreview1 ? (
                    <div className="relative inline-block">
                      <img
                        src={imagePreview1}
                        alt="Product preview 1"
                        className="max-h-48 rounded-lg object-contain"
                      />
                      <button
                        type="button"
                        onClick={removeImage1}
                        disabled={isFormDisabled}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
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
                    disabled={isFormDisabled}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Image 2 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Image 2 <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center relative transition-colors hover:border-gray-300">
                  {imagePreview2 ? (
                    <div className="relative inline-block">
                      <img
                        src={imagePreview2}
                        alt="Product preview 2"
                        className="max-h-48 rounded-lg object-contain"
                      />
                      <button
                        type="button"
                        onClick={removeImage2}
                        disabled={isFormDisabled}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
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
                    disabled={isFormDisabled}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="pt-6 border-t border-gray-100 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Available</Label>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">Make this product available for purchase</p>
                </div>
                <Switch
                  checked={formData.is_available}
                  onCheckedChange={(value) => handleChange('is_available', value)}
                  disabled={isFormDisabled}
                  className="data-[state=checked]:bg-gray-900"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Featured</Label>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">Feature this product on your storefront</p>
                </div>
                <Switch
                  checked={formData.is_featured}
                  onCheckedChange={(value) => handleChange('is_featured', value)}
                  disabled={isFormDisabled}
                  className="data-[state=checked]:bg-gray-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11 border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || isCheckingCreationLimit || !!limitReached}
              className="flex-1 h-11 bg-black hover:bg-gray-800 text-white"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </span>
              ) : isCheckingCreationLimit ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking...
                </span>
              ) : (
                'Add Product'
              )}
            </Button>
          </div>
          {limitReached && (
            <p className="text-xs text-red-600 text-center mt-2 font-medium">
              Limit reached.{' '}
              <Link href="/subscription" className="underline hover:text-red-800">
                Upgrade
              </Link>{' '}
              to add more products.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}