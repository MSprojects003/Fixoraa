// lib/api/products.ts
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Types
export interface Product {
  id: string;
  vendor_id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  weight: number | null;
  weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null;
  dimensions: string | null;
  is_available: boolean;
  is_featured: boolean;
  brand: string | null;
  colors: string[] | null;
  image_url: string | null;
  image_url_2: string | null;
  status: 'active' | 'inactive' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface CreateProductData {
  vendor_id: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  sku?: string;
  barcode?: string;
  quantity?: number;
  weight?: number | null;
  weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null;
  dimensions?: string | null;
  is_available?: boolean;
  is_featured?: boolean;
  brand?: string | null;
  colors?: string[] | null;
  image_url?: string | null;
  image_url_2?: string | null;
}

export interface UpdateProductData extends Partial<CreateProductData> {
  status?: 'active' | 'inactive' | 'deleted';
}

// Storage bucket name
const PRODUCT_IMAGES_BUCKET = 'products';

// Upload image to Supabase Storage
export async function uploadProductImage(
  file: File,
  vendorId: string,
  index: number
): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${vendorId}/product-${Date.now()}-${index}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(fileName, file);

    if (uploadError) {
      console.error("Error uploading image:", uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error("Unexpected error uploading image:", error);
    return null;
  }
}

// Delete image from Supabase Storage
export async function deleteProductImage(imageUrl: string): Promise<boolean> {
  try {
    // Extract file path from URL
    const urlParts = imageUrl.split('/');
    const filePath = urlParts.slice(urlParts.indexOf(PRODUCT_IMAGES_BUCKET) + 1).join('/');

    if (!filePath) {
      console.error("Invalid image URL");
      return false;
    }

    const { error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error("Error deleting image:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Unexpected error deleting image:", error);
    return false;
  }
}

// Upload multiple product images
export async function uploadProductImages(
  files: File[],
  vendorId: string
): Promise<string[]> {
  const uploadedUrls: string[] = [];

  for (let i = 0; i < files.length && i < 2; i++) {
    const url = await uploadProductImage(files[i], vendorId, i + 1);
    if (url) {
      uploadedUrls.push(url);
    }
  }

  return uploadedUrls;
}

// Get all products for a vendor
export async function getVendorProducts(vendorId: string): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching vendor products:", error);
      return [];
    }

    return data as Product[];
  } catch (error) {
    console.error("Unexpected error fetching vendor products:", error);
    return [];
  }
}

// Get active products for a vendor (public view)
export async function getActiveVendorProducts(vendorId: string): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'active')
      .eq('is_available', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching active vendor products:", error);
      return [];
    }

    return data as Product[];
  } catch (error) {
    console.error("Unexpected error fetching active vendor products:", error);
    return [];
  }
}

// Get single product by ID
export async function getProductById(productId: string): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error) {
      console.error("Error fetching product:", error);
      return null;
    }

    return data as Product;
  } catch (error) {
    console.error("Unexpected error fetching product:", error);
    return null;
  }
}

// Create new product with image upload support
export async function createProductWithImages(
  productData: CreateProductData,
  imageFile1?: File | null,
  imageFile2?: File | null
): Promise<Product | null> {
  try {
    let imageUrl1 = null;
    let imageUrl2 = null;

    // Upload images if provided
    if (imageFile1) {
      imageUrl1 = await uploadProductImage(imageFile1, productData.vendor_id, 1);
    }

    if (imageFile2) {
      imageUrl2 = await uploadProductImage(imageFile2, productData.vendor_id, 2);
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        ...productData,
        image_url: imageUrl1 || productData.image_url || null,
        image_url_2: imageUrl2 || productData.image_url_2 || null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating product:", error);
      return null;
    }

    return data as Product;
  } catch (error) {
    console.error("Unexpected error creating product:", error);
    return null;
  }
}

// Create new product (without image upload)
export async function createProduct(productData: CreateProductData): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .insert({
        ...productData,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating product:", error);
      return null;
    }

    return data as Product;
  } catch (error) {
    console.error("Unexpected error creating product:", error);
    return null;
  }
}

// Update product with image support
export async function updateProductWithImages(
  productId: string,
  updates: UpdateProductData,
  imageFile1?: File | null,
  imageFile2?: File | null,
  removeImage1?: boolean,
  removeImage2?: boolean
): Promise<Product | null> {
  try {
    const currentProduct = await getProductById(productId);
    if (!currentProduct) {
      console.error("Product not found");
      return null;
    }

    let imageUrl1 = currentProduct.image_url;
    let imageUrl2 = currentProduct.image_url_2;

    // Handle image removal
    if (removeImage1 && currentProduct.image_url) {
      await deleteProductImage(currentProduct.image_url);
      imageUrl1 = null;
    }

    if (removeImage2 && currentProduct.image_url_2) {
      await deleteProductImage(currentProduct.image_url_2);
      imageUrl2 = null;
    }

    // Upload new images if provided
    if (imageFile1) {
      // Delete old image if exists
      if (currentProduct.image_url) {
        await deleteProductImage(currentProduct.image_url);
      }
      imageUrl1 = await uploadProductImage(imageFile1, currentProduct.vendor_id, 1);
    }

    if (imageFile2) {
      // Delete old image if exists
      if (currentProduct.image_url_2) {
        await deleteProductImage(currentProduct.image_url_2);
      }
      imageUrl2 = await uploadProductImage(imageFile2, currentProduct.vendor_id, 2);
    }

    const { data, error } = await supabase
      .from('products')
      .update({
        ...updates,
        image_url: imageUrl1,
        image_url_2: imageUrl2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error("Error updating product:", error);
      return null;
    }

    return data as Product;
  } catch (error) {
    console.error("Unexpected error updating product:", error);
    return null;
  }
}

// Update product (without image upload)
export async function updateProduct(
  productId: string,
  updates: UpdateProductData
): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error("Error updating product:", error);
      return null;
    }

    return data as Product;
  } catch (error) {
    console.error("Unexpected error updating product:", error);
    return null;
  }
}

// Delete product (soft delete) with image cleanup
export async function deleteProduct(productId: string): Promise<boolean> {
  try {
    // Get product to delete images
    const product = await getProductById(productId);
    
    // Delete images from storage
    if (product?.image_url) {
      await deleteProductImage(product.image_url);
    }
    if (product?.image_url_2) {
      await deleteProductImage(product.image_url_2);
    }

    const { error } = await supabase
      .from('products')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (error) {
      console.error("Error deleting product:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Unexpected error deleting product:", error);
    return false;
  }
}

// Hard delete product (permanent)
export async function hardDeleteProduct(productId: string): Promise<boolean> {
  try {
    // Get product to delete images
    const product = await getProductById(productId);
    
    // Delete images from storage
    if (product?.image_url) {
      await deleteProductImage(product.image_url);
    }
    if (product?.image_url_2) {
      await deleteProductImage(product.image_url_2);
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      console.error("Error hard deleting product:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Unexpected error hard deleting product:", error);
    return false;
  }
}

// Toggle product availability
export async function toggleProductAvailability(
  productId: string,
  isAvailable: boolean
): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error("Error toggling product availability:", error);
      return null;
    }

    return data as Product;
  } catch (error) {
    console.error("Unexpected error toggling product availability:", error);
    return null;
  }
}

// Toggle product featured status
export async function toggleProductFeatured(
  productId: string,
  isFeatured: boolean
): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({
        is_featured: isFeatured,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error("Error toggling product featured status:", error);
      return null;
    }

    return data as Product;
  } catch (error) {
    console.error("Unexpected error toggling product featured status:", error);
    return null;
  }
}

// Get products by category
export async function getProductsByCategory(
  category: string,
  vendorId?: string
): Promise<Product[]> {
  try {
    let query = supabase
      .from('products')
      .select('*')
      .eq('category', category)
      .eq('status', 'active')
      .eq('is_available', true);

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching products by category:", error);
      return [];
    }

    return data as Product[];
  } catch (error) {
    console.error("Unexpected error fetching products by category:", error);
    return [];
  }
}

// Get featured products
export async function getFeaturedProducts(vendorId?: string): Promise<Product[]> {
  try {
    let query = supabase
      .from('products')
      .select('*')
      .eq('is_featured', true)
      .eq('status', 'active')
      .eq('is_available', true);

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching featured products:", error);
      return [];
    }

    return data as Product[];
  } catch (error) {
    console.error("Unexpected error fetching featured products:", error);
    return [];
  }
}

// Search products
export async function searchProducts(
  searchTerm: string,
  vendorId?: string
): Promise<Product[]> {
  try {
    let query = supabase
      .from('products')
      .select('*')
      .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
      .eq('status', 'active')
      .eq('is_available', true);

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error("Error searching products:", error);
      return [];
    }

    return data as Product[];
  } catch (error) {
    console.error("Unexpected error searching products:", error);
    return [];
  }
}

// Get products with low stock
export async function getLowStockProducts(
  vendorId: string,
  threshold: number = 10
): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'active')
      .lte('quantity', threshold)
      .order('quantity', { ascending: true });

    if (error) {
      console.error("Error fetching low stock products:", error);
      return [];
    }

    return data as Product[];
  } catch (error) {
    console.error("Unexpected error fetching low stock products:", error);
    return [];
  }
}

// Update product quantity
export async function updateProductQuantity(
  productId: string,
  quantity: number
): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({
        quantity: quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      console.error("Error updating product quantity:", error);
      return null;
    }

    return data as Product;
  } catch (error) {
    console.error("Unexpected error updating product quantity:", error);
    return null;
  }
}

// Get product count by vendor
export async function getProductCountByVendor(vendorId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', vendorId)
      .neq('status', 'deleted');

    if (error) {
      console.error("Error getting product count:", error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error("Unexpected error getting product count:", error);
    return 0;
  }
}

// Get products by multiple categories
export async function getProductsByCategories(
  categories: string[],
  vendorId?: string
): Promise<Product[]> {
  try {
    let query = supabase
      .from('products')
      .select('*')
      .in('category', categories)
      .eq('status', 'active')
      .eq('is_available', true);

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching products by categories:", error);
      return [];
    }

    return data as Product[];
  } catch (error) {
    console.error("Unexpected error fetching products by categories:", error);
    return [];
  }
}

// Bulk delete products (soft delete) with image cleanup
export async function bulkDeleteProducts(productIds: string[]): Promise<boolean> {
  try {
    // Get all products to delete images
    const products = await Promise.all(productIds.map(id => getProductById(id)));
    
    // Delete images from storage
    for (const product of products) {
      if (product?.image_url) {
        await deleteProductImage(product.image_url);
      }
      if (product?.image_url_2) {
        await deleteProductImage(product.image_url_2);
      }
    }

    const { error } = await supabase
      .from('products')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .in('id', productIds);

    if (error) {
      console.error("Error bulk deleting products:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Unexpected error bulk deleting products:", error);
    return false;
  }
}

// Duplicate product
export async function duplicateProduct(
  productId: string,
  newName?: string
): Promise<Product | null> {
  try {
    // Get the original product
    const originalProduct = await getProductById(productId);
    if (!originalProduct) {
      console.error("Original product not found");
      return null;
    }

    // Create new product data
    const newProductData: CreateProductData = {
      vendor_id: originalProduct.vendor_id,
      name: newName || `${originalProduct.name} (Copy)`,
      category: originalProduct.category,
      description: originalProduct.description || undefined,
      price: originalProduct.price,
      sku: originalProduct.sku ? `${originalProduct.sku}-COPY` : undefined,
      barcode: originalProduct.barcode || undefined,
      quantity: 0,
      weight: originalProduct.weight,
      weight_unit: originalProduct.weight_unit,
      dimensions: originalProduct.dimensions,
      is_available: false,
      is_featured: false,
      brand: originalProduct.brand,
      colors: originalProduct.colors,
      image_url: originalProduct.image_url,
      image_url_2: originalProduct.image_url_2,
    };

    return await createProduct(newProductData);
  } catch (error) {
    console.error("Unexpected error duplicating product:", error);
    return null;
  }
}