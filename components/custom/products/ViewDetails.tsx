"use client";

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  ArrowLeft,
  Loader2,
  Tag,
  Building2,
  Hash,
  Package,
  Boxes,
  Ruler,
  Weight,
} from 'lucide-react';
import { getProductById, Product } from '@/lib/api/products';
import { toast } from 'sonner';
import Image from 'next/image';

interface ViewDetailsProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

interface DetailRowProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}

function DetailRow({ icon: Icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="h-4 w-4 text-gray-400 shrink-0" />
        <span className="text-sm text-gray-600 truncate">{label}</span>
      </div>
      <span className="text-sm font-medium text-gray-900 text-right break-words">
        {value}
      </span>
    </div>
  );
}

export function ViewDetails({
  isOpen,
  onOpenChange,
  productId,
  onEdit,
  onDelete,
}: ViewDetailsProps) {
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [imageError1, setImageError1] = useState(false);
  const [imageError2, setImageError2] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId || !isOpen) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getProductById(productId);
        setProduct(data);
      } catch (error) {
        console.error('Error fetching product:', error);
        toast.error('Failed to load product details');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, isOpen]);

  // Reset image fallback state whenever the underlying product changes
  useEffect(() => {
    setImageError1(false);
    setImageError2(false);
  }, [product?.id]);

  const formatPrice = () => {
    if (!product) return '';
    return `Rs. ${product.price.toFixed(2)}`;
  };

  const getStatusColor = (isAvailable: boolean) => {
    return isAvailable ? 'bg-emerald-500' : 'bg-gray-400';
  };

  const getStatusText = (isAvailable: boolean) => {
    return isAvailable ? 'Available' : 'Unavailable';
  };

  const getStockStatus = () => {
    if (!product) return '';
    if (product.quantity === 0) return 'Out of Stock';
    if (product.quantity < 5) return 'Low Stock';
    return 'In Stock';
  };

  const getStockColor = () => {
    if (!product) return '';
    if (product.quantity === 0) return 'text-red-600 bg-red-50';
    if (product.quantity < 5) return 'text-amber-600 bg-amber-50';
    return 'text-emerald-600 bg-emerald-50';
  };

  const getInitials = () => {
    if (!product?.name) return 'P';
    return product.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleEdit = () => {
    if (onEdit && productId) {
      onEdit(productId);
      onOpenChange(false);
    }
  };

  const handleDelete = () => {
    if (onDelete && productId) {
      onDelete(productId);
      onOpenChange(false);
    }
  };

  if (loading) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Loading product details</SheetTitle>
            <SheetDescription>Please wait while we load the product</SheetDescription>
          </SheetHeader>
          <div className="flex items-center justify-center min-h-screen">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="text-sm text-gray-500">Loading product details...</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!product) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Product not found</SheetTitle>
            <SheetDescription>The requested product could not be loaded</SheetDescription>
          </SheetHeader>
          <div className="flex items-center justify-center min-h-screen px-6">
            <div className="text-center">
              <p className="text-gray-500">Product not found</p>
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
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 bg-white flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-9 w-9 shrink-0 rounded-full hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <SheetTitle className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                  Product Details
                </SheetTitle>
                <SheetDescription className="text-xs sm:text-sm text-gray-500 truncate">
                  Complete information about this product
                </SheetDescription>
              </div>
            </div>
            <Badge className={`${getStatusColor(product.is_available)} shrink-0`}>
              {getStatusText(product.is_available)}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8 max-w-3xl mx-auto w-full">
          {/* Image Section */}
          <div className="relative w-full aspect-[4/3] sm:aspect-video bg-gray-50 rounded-lg overflow-hidden mb-6">
            {product.image_url && !imageError1 ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, 576px"
                className="object-cover"
                onError={() => setImageError1(true)}
              />
            ) : product.image_url_2 && !imageError2 ? (
              <Image
                src={product.image_url_2}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, 576px"
                className="object-cover"
                onError={() => setImageError2(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <Package className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-2" />
                  <span className="text-2xl sm:text-3xl font-semibold text-gray-300">
                    {getInitials()}
                  </span>
                </div>
              </div>
            )}

            {/* Image Count Badge */}
            {(product.image_url || product.image_url_2) && (
              <Badge className="absolute bottom-3 right-3 bg-black/60 text-white border-0 text-xs px-2 py-1">
                {product.image_url && product.image_url_2 ? '2 images' : '1 image'}
              </Badge>
            )}
          </div>

          {/* Name & Price */}
          <div className="flex flex-col gap-3 pb-6 border-b border-gray-100 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 break-words">
                {product.name}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {product.category}
                </Badge>
                {product.brand && (
                  <Badge variant="outline" className="text-xs">
                    {product.brand}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-semibold text-gray-900 whitespace-nowrap sm:text-right">
              {formatPrice()}
            </div>
          </div>

          {/* Details Grid */}
          <div className="mt-6 space-y-6">
            {/* Overview Section */}
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Overview
              </h3>
              <div>
                <DetailRow icon={Hash} label="SKU" value={product.sku || 'Not specified'} />
                <DetailRow icon={Hash} label="Barcode" value={product.barcode || 'Not specified'} />
                <DetailRow icon={Tag} label="Category" value={product.category} />
                <DetailRow icon={Building2} label="Brand" value={product.brand || 'Not specified'} />
              </div>
            </section>

            {/* Inventory Section */}
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Inventory
              </h3>
              <div>
                <DetailRow icon={Boxes} label="Quantity" value={`${product.quantity} units`} />
                <DetailRow
                  icon={product.is_available && product.quantity > 0 ? CheckCircle : XCircle}
                  label="Stock Status"
                  value={<Badge className={getStockColor()}>{getStockStatus()}</Badge>}
                />
              </div>
            </section>

            {/* Weight & Dimensions Section */}
            {(product.weight || product.dimensions) && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Shipping Details
                </h3>
                <div>
                  {product.weight && (
                    <DetailRow
                      icon={Weight}
                      label="Weight"
                      value={`${product.weight} ${product.weight_unit ?? ''}`.trim()}
                    />
                  )}
                  {product.dimensions && (
                    <DetailRow icon={Ruler} label="Dimensions" value={product.dimensions} />
                  )}
                </div>
              </section>
            )}

            {/* Colors Section */}
            {product.colors && product.colors.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Available Colors
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-3">
                  {product.colors.map((hex, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full border border-gray-200 shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                      <span className="text-sm text-gray-600">{hex}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Description */}
            {product.description && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Description
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-4">
                  {product.description}
                </p>
              </section>
            )}

            {/* Record Info */}
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Record
              </h3>
              <div>
                <DetailRow
                  icon={Hash}
                  label="Created"
                  value={new Date(product.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                />
                <DetailRow
                  icon={Hash}
                  label="Last Updated"
                  value={new Date(product.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                />
              </div>
            </section>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4">
          <div className="max-w-3xl mx-auto flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              {onEdit && (
                <Button
                  onClick={handleEdit}
                  className="w-full sm:w-auto bg-black hover:bg-gray-800 text-white"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Product
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Product
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}