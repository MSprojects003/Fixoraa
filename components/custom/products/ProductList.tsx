"use client";

import React, { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import DeleteProduct from './DeleteProduct';
import { EditProduct } from './EditProduct';
import { ViewDetails } from './ViewDetails';
import { Search, Filter, Plus, Loader2, Package } from 'lucide-react';
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
import { getVendorProducts, deleteProduct, Product } from '@/lib/api/products';
import { toast } from 'sonner';

interface ProductListProps {
  vendorId?: string;
  onAddProduct?: () => void;
  onEditProduct?: (productId: string) => void;
  onViewProduct?: (productId: string) => void;
  refreshKey?: number;
  onProductDeleted?: () => void;
  onProductUpdated?: () => void;
}

function ProductList({
  vendorId,
  onAddProduct,
  onEditProduct,
  onViewProduct,
  refreshKey = 0,
  onProductDeleted,
  onProductUpdated,
}: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'unavailable' | 'lowstock'>('all');
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string; sku: string | null } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<string | null>(null);

  // View details sheet state
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [productToView, setProductToView] = useState<string | null>(null);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      if (!vendorId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getVendorProducts(vendorId);
        setProducts(data);
      } catch (error) {
        console.error('Error fetching products:', error);
        toast.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [vendorId, refreshKey]);

  // Filter products
  const filteredProducts = products.filter((product) => {
    // Search filter
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    // Status filter
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'available' && product.is_available && product.quantity > 0) ||
      (filterStatus === 'unavailable' && (!product.is_available || product.quantity === 0)) ||
      (filterStatus === 'lowstock' && product.is_available && product.quantity > 0 && product.quantity < 5);

    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalProducts = products.length;
  const availableProducts = products.filter(p => p.is_available && p.quantity > 0).length;
  const lowStockProducts = products.filter(p => p.is_available && p.quantity > 0 && p.quantity < 5).length;
  const outOfStockProducts = products.filter(p => !p.is_available || p.quantity === 0).length;

  // Handle delete click - open dialog
  const handleDeleteClick = (id: string) => {
    const product = products.find(p => p.id === id);
    if (product) {
      setProductToDelete({ 
        id: product.id, 
        name: product.name,
        sku: product.sku 
      });
      setDeleteDialogOpen(true);
    }
  };

  // Handle edit click - open sheet
  const handleEditClick = (id: string) => {
    setProductToEdit(id);
    setEditSheetOpen(true);
    if (onEditProduct) {
      onEditProduct(id);
    }
  };

  // Handle view click - open sheet
  const handleViewClick = (id: string) => {
    setProductToView(id);
    setViewSheetOpen(true);
    if (onViewProduct) {
      onViewProduct(id);
    }
  };

  // Handle confirm delete
  const handleConfirmDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      const success = await deleteProduct(id);
      
      if (success) {
        toast.success('Product deleted successfully');
        // Refresh the list
        const updatedProducts = await getVendorProducts(vendorId!);
        setProducts(updatedProducts);
        setDeleteDialogOpen(false);
        setProductToDelete(null);
        if (onProductDeleted) {
          onProductDeleted();
        }
      } else {
        toast.error('Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('An error occurred while deleting');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle product update success
  const handleProductUpdated = () => {
    const fetchProducts = async () => {
      if (vendorId) {
        const data = await getVendorProducts(vendorId);
        setProducts(data);
      }
    };
    fetchProducts();
    if (onProductUpdated) {
      onProductUpdated();
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-[120px]" />
          </div>
          <Skeleton className="h-9 w-[100px]" />
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
              <Skeleton className="w-full h-40" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-8">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <Package className="h-7 w-7 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No Products Yet</h3>
        <p className="text-sm text-gray-500 max-w-md mb-4">
          You haven't added any products to your inventory yet.
        </p>
         
      </div>
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
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm border-gray-300 focus-visible:ring-black"
              />
            </div>
            <Select
              value={filterStatus}
              onValueChange={(value: 'all' | 'available' | 'unavailable' | 'lowstock') => setFilterStatus(value)}
            >
              <SelectTrigger className="w-[120px] h-9 text-sm border-gray-300 focus-visible:ring-black">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="lowstock">Low Stock</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span>Total: <strong className="text-gray-900">{totalProducts}</strong></span>
          <span>•</span>
          <span>Available: <strong className="text-emerald-600">{availableProducts}</strong></span>
          {lowStockProducts > 0 && (
            <>
              <span>•</span>
              <span>Low Stock: <strong className="text-amber-600">{lowStockProducts}</strong></span>
            </>
          )}
          {outOfStockProducts > 0 && (
            <>
              <span>•</span>
              <span>Out of Stock: <strong className="text-red-600">{outOfStockProducts}</strong></span>
            </>
          )}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              price={product.price}
              image_url={product.image_url}
              image_url_2={product.image_url_2}
              quantity={product.quantity}
              is_available={product.is_available}
              is_featured={product.is_featured}
              category={product.category}
              brand={product.brand}
              colors={product.colors}
              onView={handleViewClick}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>

        {/* Empty State for filtered results */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No products match your filters</p>
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
      <DeleteProduct
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        productName={productToDelete?.name}
        productId={productToDelete?.id}
        productSku={productToDelete?.sku}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Edit Product Sheet */}
      <EditProduct
        isOpen={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        productId={productToEdit || undefined}
        vendorId={vendorId}
        onSuccess={handleProductUpdated}
      />

      {/* View Details Sheet */}
      <ViewDetails
        isOpen={viewSheetOpen}
        onOpenChange={setViewSheetOpen}
        productId={productToView || undefined}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
      />
    </>
  );
}

export default ProductList;