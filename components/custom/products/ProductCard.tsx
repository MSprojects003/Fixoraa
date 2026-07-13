"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image_url?: string | null;
  image_url_2?: string | null;
  quantity: number;
  is_available?: boolean;
  is_featured?: boolean;
  category?: string;
  brand?: string | null;
  colors?: string[] | null;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function ProductCard({
  id,
  name,
  price,
  image_url,
  image_url_2,
  quantity,
  is_available = true,
  is_featured = false,
  category,
  brand,
  colors,
  onView,
  onEdit,
  onDelete,
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError1, setImageError1] = useState(false);
  const [imageError2, setImageError2] = useState(false);

  // Check if stock is low (less than 5)
  const isLowStock = quantity < 5 && quantity > 0;
  const isOutOfStock = quantity === 0;

  // Get status badge - Now positioned on left
  const getStatusBadge = () => {
    if (isOutOfStock) {
      return (
        <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full border-0">
          <XCircle className="h-3 w-3 mr-1" />
          Out of Stock
        </Badge>
      );
    }
    if (isLowStock) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full border-0">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Low Stock
        </Badge>
      );
    }
    if (is_available) {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full border-0">
          <CheckCircle className="h-3 w-3 mr-1" />
          Available
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-400 hover:bg-gray-500 text-white text-[10px] font-medium px-2 py-0.5 rounded-full border-0">
        <XCircle className="h-3 w-3 mr-1" />
        Unavailable
      </Badge>
    );
  };

  // Format price
  const formatPrice = () => {
    return `Rs. ${price.toFixed(2)}`;
  };

  // Get initials for fallback
  const getInitials = () => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get color swatches
  const getColorSwatches = () => {
    if (!colors || colors.length === 0) return null;
    const displayColors = colors.slice(0, 3);
    const remaining = colors.length - 3;
    return (
      <div className="flex items-center gap-1">
        {displayColors.map((hex, index) => (
          <div
            key={index}
            className="w-3 h-3 rounded-full border border-gray-200"
            style={{ backgroundColor: hex }}
            title={hex}
          />
        ))}
        {remaining > 0 && (
          <span className="text-[10px] text-gray-400">+{remaining}</span>
        )}
      </div>
    );
  };

  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onView) onView(id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(id);
  };

  // Determine which image to show with proper null checks
  const hasSecondImage = !!(image_url_2 && !imageError2);
  const mainImage = image_url && !imageError1 ? image_url : null;
  const secondImage = image_url_2 && !imageError2 ? image_url_2 : null;

  return (
    <Card 
      className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border border-gray-200 hover:border-gray-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Section */}
      <div className="relative w-full h-40 bg-gray-100 overflow-hidden">
        {/* Image Container with Hover Transition */}
        <div className="relative w-full h-full">
          {/* Default Image (First Image) */}
          <div 
            className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
              isHovered && hasSecondImage ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {mainImage ? (
              <Image
                src={mainImage}
                alt={name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                onError={() => setImageError1(true)}
                priority={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                <div className="text-center">
                  <Package className="h-10 w-10 text-gray-400 mx-auto mb-1" />
                  <span className="text-2xl font-bold text-gray-400">
                    {getInitials()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Second Image (on Hover) */}
          {hasSecondImage && secondImage && (
            <div 
              className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                isHovered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <Image
                src={secondImage}
                alt={`${name} - alternate view`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                onError={() => setImageError2(true)}
                priority={false}
              />
            </div>
          )}

          {/* Image Counter Badge (if second image exists) */}
          {hasSecondImage && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm z-10">
              {isHovered ? '2/2' : '1/2'}
            </div>
          )}
        </div>

        {/* Featured Badge - Top Left */}
        {is_featured && (
          <Badge className="absolute top-2 left-2 bg-yellow-500 hover:bg-yellow-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full border-0 z-10">
            ⭐ Featured
          </Badge>
        )}

        {/* Status Badge - Below Featured or Top Left */}
        <div className="absolute top-2 left-2 z-10">
          {is_featured ? (
            <div className="mt-6">
              {getStatusBadge()}
            </div>
          ) : (
            getStatusBadge()
          )}
        </div>

        {/* Category Badge - Bottom Left */}
        {category && (
          <Badge className="absolute bottom-2 left-2 bg-black/70 text-white border-0 hover:bg-black/70 text-[10px] px-2 py-0.5 z-10">
            {category}
          </Badge>
        )}

        {/* Brand Badge - Bottom Right (shifted if image counter exists) */}
        {brand && (
          <Badge className={`absolute bottom-2 ${hasSecondImage ? 'right-14' : 'right-2'} bg-white/90 text-black border-0 hover:bg-white/90 text-[10px] px-2 py-0.5 z-10`}>
            {brand}
          </Badge>
        )}

        {/* Three Dots Menu */}
        <div className="absolute top-2 right-4 z-20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-white/90 hover:bg-white rounded-full shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5 text-gray-700" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onView && (
                <DropdownMenuItem
                  className="cursor-pointer flex items-center gap-2 text-sm"
                  onClick={handleViewClick}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Details
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem
                  className="cursor-pointer flex items-center gap-2 text-sm"
                  onClick={handleEditClick}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit Product
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  className="cursor-pointer flex items-center gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Product
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content Section */}
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 flex-1">
            {name}
          </h3>
        </div>

        {/* Price */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-sm font-bold text-emerald-600">
            {formatPrice()}
          </span>
          {isLowStock && !isOutOfStock && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
              Only {quantity} left
            </span>
          )}
          {isOutOfStock && (
            <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
              Sold Out
            </span>
          )}
        </div>

        {/* Color Swatches */}
        {getColorSwatches()}

        {/* Stock Indicator */}
        {!isOutOfStock && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div
                className={`h-1 rounded-full transition-all duration-500 ${
                  isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min((quantity / 100) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {quantity} units available
            </p>
          </div>
        )}

        {/* Image 2 indicator in content */}
        {hasSecondImage && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              {isHovered ? 'Viewing second image' : 'Hover to view second image'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProductCard;