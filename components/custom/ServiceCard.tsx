"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MoreVertical, Edit2, Trash2, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface ServiceCardProps {
  id: string;
  name: string;
  price: number;
  price_type: 'fixed' | 'hourly';
  min_duration?: number | null;
  duration_unit?: 'minutes' | 'hours' | 'days' | 'weeks' | null;
  image_url?: string | null;
  is_available?: boolean;
  max_capacity?: number | null;
  preparation_time?: number | null;
  category?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
}

function ServiceCard({
  id,
  name,
  price,
  price_type,
  min_duration,
  duration_unit,
  image_url,
  is_available = true,
  max_capacity,
  preparation_time,
  category,
  onEdit,
  onDelete,
  onView,
}: ServiceCardProps) {
  // Format price display
  const formatPrice = () => {
    if (price_type === 'hourly') {
      return `Rs. ${price}/hr`;
    }
    return `Rs. ${price}`;
  };

  // Format duration
  const formatDuration = () => {
    if (!min_duration || !duration_unit) return null;
    const unitMap = {
      minutes: 'min',
      hours: 'hr',
      days: 'day',
      weeks: 'wk',
    };
    return `${min_duration} ${unitMap[duration_unit]}${min_duration > 1 ? 's' : ''}`;
  };

  // Get initials for fallback
  const getInitials = () => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const duration = formatDuration();
  const priceDisplay = formatPrice();

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(id);
    }
  };

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border border-gray-200 hover:border-gray-300">
      {/* Image Section - Smaller */}
      <div className="relative w-full h-32 bg-gray-100 overflow-hidden">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <span className="text-2xl font-bold text-gray-400">
              {getInitials()}
            </span>
          </div>
        )}
        
        {/* Category Badge */}
        {category && (
          <Badge className="absolute bottom-2 left-2 bg-white/90 text-black border-0 hover:bg-white/90 text-xs">
            {category}
          </Badge>
        )}

        {/* Status Badge - Top Left */}
        <Badge 
          className={`
            absolute top-2 left-2
            ${is_available 
              ? 'bg-emerald-500 hover:bg-emerald-600' 
              : 'bg-gray-400 hover:bg-gray-500'
            } text-white text-[10px] font-medium px-2 py-0.5 rounded-full border-0
          `}
        >
          {is_available ? 'Available' : 'Unavailable'}
        </Badge>

        {/* Three Dots Menu - Top Right */}
        <div className="absolute top-2 right-2 z-10">
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
                  onClick={() => onView(id)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Details
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem 
                  className="cursor-pointer flex items-center gap-2 text-sm"
                  onClick={() => onEdit(id)}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit Service
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  className="cursor-pointer flex items-center gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Service
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content Section - Compact */}
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 flex-1">
            {name}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {priceDisplay}
          </span>
          <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
            {price_type === 'hourly' ? 'Hourly' : 'Fixed'}
          </span>
        </div>

        {/* Details - Compact */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {duration && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-gray-400" />
              <span>{duration}</span>
            </div>
          )}
          {max_capacity && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400">👤</span>
              <span>Max {max_capacity}</span>
            </div>
          )}
          {preparation_time && preparation_time > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-gray-400" />
              <span>Prep {preparation_time}m</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ServiceCard;