// lib/api/services.ts
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Types
export interface Service {
  id: string;
  vendor_id: string;
  name: string;
  category: string;
  description: string | null;
  price_type: 'fixed' | 'hourly';
  price: number;
  min_duration: number | null;
  duration_unit: 'minutes' | 'hours' | 'days' | 'weeks' | null;
  is_available: boolean;
  has_preparation_time: boolean;
  preparation_time: number | null;
  max_capacity: number | null;
  policies: string | null;
  image_url: string | null;
  status: 'active' | 'inactive' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface CreateServiceData {
  vendor_id: string;
  name: string;
  category: string;
  description?: string;
  price_type: 'fixed' | 'hourly';
  price: number;
  min_duration?: number | null;
  duration_unit?: 'minutes' | 'hours' | 'days' | 'weeks' | null;
  is_available?: boolean;
  has_preparation_time?: boolean;
  preparation_time?: number | null;
  max_capacity?: number | null;
  policies?: string | null;
  image_url?: string | null;
}

export interface UpdateServiceData extends Partial<CreateServiceData> {
  status?: 'active' | 'inactive' | 'deleted';
}

// Get all services for a vendor
export async function getVendorServices(vendorId: string): Promise<Service[]> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('vendor_id', vendorId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching vendor services:", error);
      return [];
    }

    return data as Service[];
  } catch (error) {
    console.error("Unexpected error fetching vendor services:", error);
    return [];
  }
}

// Get active services for a vendor (public view)
export async function getActiveVendorServices(vendorId: string): Promise<Service[]> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'active')
      .eq('is_available', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching active vendor services:", error);
      return [];
    }

    return data as Service[];
  } catch (error) {
    console.error("Unexpected error fetching active vendor services:", error);
    return [];
  }
}

// Get single service by ID
export async function getServiceById(serviceId: string): Promise<Service | null> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single();

    if (error) {
      console.error("Error fetching service:", error);
      return null;
    }

    return data as Service;
  } catch (error) {
    console.error("Unexpected error fetching service:", error);
    return null;
  }
}

// Create new service
export async function createService(serviceData: CreateServiceData): Promise<Service | null> {
  try {
    const { data, error } = await supabase
      .from('services')
      .insert({
        ...serviceData,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating service:", error);
      return null;
    }

    return data as Service;
  } catch (error) {
    console.error("Unexpected error creating service:", error);
    return null;
  }
}

// Update service
export async function updateService(
  serviceId: string,
  updates: UpdateServiceData
): Promise<Service | null> {
  try {
    const { data, error } = await supabase
      .from('services')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', serviceId)
      .select()
      .single();

    if (error) {
      console.error("Error updating service:", error);
      return null;
    }

    return data as Service;
  } catch (error) {
    console.error("Unexpected error updating service:", error);
    return null;
  }
}

// Delete service (soft delete)
export async function deleteService(serviceId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('services')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', serviceId);

    if (error) {
      console.error("Error deleting service:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Unexpected error deleting service:", error);
    return false;
  }
}

// Hard delete service (permanent)
export async function hardDeleteService(serviceId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', serviceId);

    if (error) {
      console.error("Error hard deleting service:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Unexpected error hard deleting service:", error);
    return false;
  }
}

// Toggle service availability
export async function toggleServiceAvailability(
  serviceId: string,
  isAvailable: boolean
): Promise<Service | null> {
  try {
    const { data, error } = await supabase
      .from('services')
      .update({
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', serviceId)
      .select()
      .single();

    if (error) {
      console.error("Error toggling service availability:", error);
      return null;
    }

    return data as Service;
  } catch (error) {
    console.error("Unexpected error toggling service availability:", error);
    return null;
  }
}

// Get services by category
export async function getServicesByCategory(
  category: string,
  vendorId?: string
): Promise<Service[]> {
  try {
    let query = supabase
      .from('services')
      .select('*')
      .eq('category', category)
      .eq('status', 'active')
      .eq('is_available', true);

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching services by category:", error);
      return [];
    }

    return data as Service[];
  } catch (error) {
    console.error("Unexpected error fetching services by category:", error);
    return [];
  }
}

// Search services
export async function searchServices(
  searchTerm: string,
  vendorId?: string
): Promise<Service[]> {
  try {
    let query = supabase
      .from('services')
      .select('*')
      .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      .eq('status', 'active')
      .eq('is_available', true);

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error("Error searching services:", error);
      return [];
    }

    return data as Service[];
  } catch (error) {
    console.error("Unexpected error searching services:", error);
    return [];
  }
}