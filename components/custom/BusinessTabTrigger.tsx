"use client";

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, BriefcaseBusiness, ShoppingBasket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddService } from '@/components/custom/AddService';
import { AddProducts } from '@/components/custom/products/AddProducts';
import ServiceList from '@/components/custom/ServiceList';
import ProductList from '@/components/custom/products/ProductList';
import { toast } from 'sonner';

interface BusinessTabTriggerProps {
  businessId?: string;
  vendorCategory?: string;
  onAddService?: () => void;
  onAddProduct?: () => void;
  onServiceAdded?: () => void;
  onServiceDeleted?: () => void;
  onProductAdded?: () => void;
}

function BusinessTabTrigger({ 
  businessId, 
  vendorCategory,
  onAddService,
  onAddProduct,
  onServiceAdded,
  onServiceDeleted,
  onProductAdded,
}: BusinessTabTriggerProps) {
  const [activeTab, setActiveTab] = useState('services');
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAddServiceClick = () => {
    setIsAddServiceOpen(true);
    if (onAddService) {
      onAddService();
    }
  };

  const handleAddProductClick = () => {
    setIsAddProductOpen(true);
    if (onAddProduct) {
      onAddProduct();
    }
  };

  const handleServiceAdded = () => {
    setRefreshKey(prev => prev + 1);
    if (onServiceAdded) {
      onServiceAdded();
    }
    toast.success('Service added successfully!');
  };

  const handleServiceDeleted = () => {
    setRefreshKey(prev => prev + 1);
    if (onServiceDeleted) {
      onServiceDeleted();
    }
  };

  const handleProductAdded = () => {
    setRefreshKey(prev => prev + 1);
    if (onProductAdded) {
      onProductAdded();
    }
    toast.success('Product added successfully!');
  };

  // Service action handlers
  const handleViewService = (id: string) => {
    console.log('View service:', id);
    toast.info('Viewing service details');
  };

  const handleEditService = (id: string) => {
    console.log('Edit service:', id);
    toast.info('Editing service');
  };

  // Product action handlers
  const handleViewProduct = (id: string) => {
    console.log('View product:', id);
    toast.info('Viewing product details');
  };

  const handleEditProduct = (id: string) => {
    console.log('Edit product:', id);
    toast.info('Editing product');
  };

  return (
    <div className="w-full">
      <Tabs 
        defaultValue="services" 
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        {/* Tab Triggers */}
        <div className="flex justify-center items-center gap-8 md:gap-12 mb-6 pb-2 border-b border-gray-200">
          <TabsList className="bg-transparent gap-8 md:gap-x-96">
            <TabsTrigger 
              value="services" 
              className={`
                data-[state=active]:bg-transparent 
                data-[state=active]:shadow-white
                data-[state=active]:border-b-2
                data-[state=active]:border-r-0
                data-[state=active]:text-black
                data-[state=active]:rounded-none
                data-[state=active]:pb-2
                data-[state=active]:border-t-0
                data-[state=active]:border-black
                data-[state=active]:border-l-0
                border-t-0
                border-b-0
                border-l-0
                border-r-0
                border-gray-200
                bg-transparent
                hover:bg-transparent
                hover:text-black
                px-4 py-2
                text-gray-400
                transition-all
                duration-300
                flex items-center gap-2
                group
              `}
            >
              <BriefcaseBusiness className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium hidden sm:block">Services</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="products" 
              className={`
                data-[state=active]:bg-transparent 
                data-[state=active]:shadow-white
                data-[state=active]:border-b-2
                data-[state=active]:border-r-0
                data-[state=active]:text-black
                data-[state=active]:rounded-none
                data-[state=active]:pb-2
                data-[state=active]:border-t-0
                data-[state=active]:border-black
                data-[state=active]:border-l-0
                border-t-0
                border-b-0
                border-l-0
                border-r-0
                border-gray-200
                bg-transparent
                hover:bg-transparent
                hover:text-black
                px-4 py-2
                text-gray-400
                transition-all
                duration-300
                flex items-center gap-2
                group
              `}
            >
              <ShoppingBasket className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
              <span className="text-sm font-medium hidden sm:block">Products</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Services Tab Content */}
        <TabsContent value="services" className="relative min-h-[200px] mt-4">
          <ServiceList
            key={refreshKey}
            vendorId={businessId}
            onAddService={handleAddServiceClick}
            onViewService={handleViewService}
            onEditService={handleEditService}
            onServiceDeleted={handleServiceDeleted}
          />

          {/* Floating Action Button - Services */}
          <Button
            onClick={handleAddServiceClick}
            className="fixed bottom-8 right-8 h-14 w-14 rounded-full bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-2xl transition-all duration-300 z-50 flex items-center justify-center group"
          >
            <Plus className="h-6 w-6 transition-transform duration-300 group-hover:rotate-90" />
          </Button>
        </TabsContent>

        {/* Products Tab Content */}
        <TabsContent value="products" className="relative min-h-[200px] mt-4">
          <ProductList
            key={refreshKey}
            vendorId={businessId}
            onAddProduct={handleAddProductClick}
            onViewProduct={handleViewProduct}
            onEditProduct={handleEditProduct}
            onProductDeleted={handleProductAdded}
          />

          {/* Floating Action Button - Products */}
          <Button
            onClick={handleAddProductClick}
            className="fixed bottom-8 right-8 h-14 w-14 rounded-full bg-black hover:bg-gray-800 text-white shadow-lg hover:shadow-2xl transition-all duration-300 z-50 flex items-center justify-center group"
          >
            <Plus className="h-6 w-6 transition-transform duration-300 group-hover:rotate-90" />
          </Button>
        </TabsContent>
      </Tabs>

      {/* Add Service Sheet */}
      <AddService
        isOpen={isAddServiceOpen}
        onOpenChange={setIsAddServiceOpen}
        vendorId={businessId}
        vendorCategory={vendorCategory}
        onSuccess={handleServiceAdded}
      />

      {/* Add Product Sheet */}
      <AddProducts
        isOpen={isAddProductOpen}
        onOpenChange={setIsAddProductOpen}
        vendorId={businessId}
        vendorCategory={vendorCategory}
        onSuccess={handleProductAdded}
      />
    </div>
  );
}

export default BusinessTabTrigger;