"use client";

import React, { useState, useEffect } from 'react';
import ServiceCard from './ServiceCard';
import DeleteService from './DeleteService';
import { EditService } from './EditService';
import { ServiceDetails } from './ServiceDetails';
import { Search, Filter, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getVendorServices, deleteService, Service } from '@/lib/api/services';
import { toast } from 'sonner';

interface ServiceListProps {
  vendorId?: string;
  onAddService?: () => void;
  onEditService?: (serviceId: string) => void;
  onViewService?: (serviceId: string) => void;
  refreshKey?: number;
  onServiceDeleted?: () => void;
  onServiceUpdated?: () => void;
}

function ServiceList({
  vendorId,
  onAddService,
  onEditService,
  onViewService,
  refreshKey = 0,
  onServiceDeleted,
  onServiceUpdated,
}: ServiceListProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'unavailable'>('all');
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<string | null>(null);

  // Details sheet state
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [serviceToView, setServiceToView] = useState<string | null>(null);

  // Fetch services from database
  useEffect(() => {
    const fetchServices = async () => {
      if (!vendorId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getVendorServices(vendorId);
        setServices(data);
      } catch (error) {
        console.error('Error fetching services:', error);
        toast.error('Failed to load services');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [vendorId, refreshKey]);

  // Filter services
  const filteredServices = services.filter((service) => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'available' && service.is_available) ||
      (filterStatus === 'unavailable' && !service.is_available);

    return matchesSearch && matchesStatus;
  });

  // Handle view click - open details sheet
  const handleViewClick = (id: string) => {
    setServiceToView(id);
    setDetailsSheetOpen(true);
    if (onViewService) {
      onViewService(id);
    }
  };

  // Handle delete click - open dialog
  const handleDeleteClick = (id: string) => {
    const service = services.find(s => s.id === id);
    if (service) {
      setServiceToDelete({ id: service.id, name: service.name });
      setDeleteDialogOpen(true);
    }
  };

  // Handle edit click - open sheet
  const handleEditClick = (id: string) => {
    setServiceToEdit(id);
    setEditSheetOpen(true);
    if (onEditService) {
      onEditService(id);
    }
  };

  // Handle confirm delete
  const handleConfirmDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      const success = await deleteService(id);
      
      if (success) {
        toast.success('Service deleted successfully');
        const updatedServices = await getVendorServices(vendorId!);
        setServices(updatedServices);
        setDeleteDialogOpen(false);
        setServiceToDelete(null);
        if (onServiceDeleted) {
          onServiceDeleted();
        }
      } else {
        toast.error('Failed to delete service');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('An error occurred while deleting');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle service update success
  const handleServiceUpdated = () => {
    const fetchServices = async () => {
      if (vendorId) {
        const data = await getVendorServices(vendorId);
        setServices(data);
      }
    };
    fetchServices();
    if (onServiceUpdated) {
      onServiceUpdated();
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
            <div className="relative flex-1">
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-[120px]" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-28" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
              <Skeleton className="w-full h-32" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-8">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <Plus className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No Services Yet</h3>
          <p className="text-sm text-gray-500 max-w-md mb-4">
            You haven't added any services to your business yet.
          </p>
          {onAddService && (
            <Button onClick={onAddService} className="bg-black hover:bg-gray-800 text-sm h-9">
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with Search and Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm border-gray-300 focus-visible:ring-black"
              />
            </div>
            <Select
              value={filterStatus}
              onValueChange={(value: 'all' | 'available' | 'unavailable') => setFilterStatus(value)}
            >
              <SelectTrigger className="w-[120px] h-9 text-sm border-gray-300 focus-visible:ring-black">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Total: <strong className="text-gray-900">{services.length}</strong></span>
          <span>•</span>
          <span>Available: <strong className="text-emerald-600">{services.filter(s => s.is_available).length}</strong></span>
          <span>•</span>
          <span>Unavailable: <strong className="text-gray-400">{services.filter(s => !s.is_available).length}</strong></span>
        </div>

        {/* Service Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              id={service.id}
              name={service.name}
              price={service.price}
              price_type={service.price_type}
              min_duration={service.min_duration}
              duration_unit={service.duration_unit}
              image_url={service.image_url}
              is_available={service.is_available}
              max_capacity={service.max_capacity}
              preparation_time={service.preparation_time}
              category={service.category}
              onView={handleViewClick}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>

        {/* Empty State for filtered results */}
        {filteredServices.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No services match your filters</p>
            <Button
              variant="ghost"
              className="mt-1 text-sm text-black hover:bg-gray-100 h-8"
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('all');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteService
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        serviceName={serviceToDelete?.name}
        serviceId={serviceToDelete?.id}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Edit Service Sheet - FIXED: vendorId is now passed */}
      <EditService
        isOpen={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        serviceId={serviceToEdit || undefined}
        vendorId={vendorId}  // ← THIS IS THE KEY FIX
        onSuccess={handleServiceUpdated}
      />

      {/* Service Details Sheet */}
      <ServiceDetails
        isOpen={detailsSheetOpen}
        onOpenChange={setDetailsSheetOpen}
        serviceId={serviceToView || undefined}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />
    </>
  );
}

export default ServiceList;