// lib/api/vendor.ts
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Types
export interface Vendor {
  id: string;
  user_id: string;
  vendor_name: string | null;
  branch: string | null;
  image1: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorWithUser extends Vendor {
  user?: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    profile_image: string | null;
  };
}

// Get vendor by user ID
export async function getVendorByUserId(userId: string): Promise<Vendor | null> {
  try {
    const { data: vendor, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No vendor found for this user
        return null;
      }
      console.error("Error fetching vendor:", error);
      return null;
    }

    return vendor as Vendor;
  } catch (error) {
    console.error("Unexpected error fetching vendor:", error);
    return null;
  }
}

// Get vendor with user details
export async function getVendorWithUser(userId: string): Promise<VendorWithUser | null> {
  try {
    const { data: vendor, error } = await supabase
      .from('vendors')
      .select(`
        *,
        user:users (
          email,
          first_name,
          last_name,
          profile_image
        )
      `)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error("Error fetching vendor with user:", error);
      return null;
    }

    return vendor as VendorWithUser;
  } catch (error) {
    console.error("Unexpected error fetching vendor with user:", error);
    return null;
  }
}

// Get current user's vendor
export async function getCurrentUserVendor(): Promise<Vendor | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("No user logged in");
      return null;
    }

    return await getVendorByUserId(user.id);
  } catch (error) {
    console.error("Error fetching current user vendor:", error);
    return null;
  }

  
}

// Get all vendors (admin only)
export async function getAllVendors(): Promise<Vendor[]> {
  try {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching all vendors:", error);
      return [];
    }

    return vendors as Vendor[];
  } catch (error) {
    console.error("Unexpected error fetching vendors:", error);
    return [];
  }
}

// Create or update vendor (upsert)
export async function upsertVendor(vendorData: {
  user_id: string;
  vendor_name?: string;
  branch?: string;
  address?: string;
  image1?: string | null;
}): Promise<Vendor | null> {
  try {
    // Check if vendor exists
    const existingVendor = await getVendorByUserId(vendorData.user_id);
    
    let result;
    
    if (existingVendor) {
      // Update existing vendor
      const { data: vendor, error } = await supabase
        .from('vendors')
        .update({
          vendor_name: vendorData.vendor_name ?? existingVendor.vendor_name,
          branch: vendorData.branch ?? existingVendor.branch,
          address: vendorData.address ?? existingVendor.address,
          image1: vendorData.image1 !== undefined ? vendorData.image1 : existingVendor.image1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', vendorData.user_id)
        .select()
        .single();

      if (error) throw error;
      result = vendor;
    } else {
      // Create new vendor
      const { data: vendor, error } = await supabase
        .from('vendors')
        .insert({
          user_id: vendorData.user_id,
          vendor_name: vendorData.vendor_name || null,
          branch: vendorData.branch || null,
          address: vendorData.address || null,
          image1: vendorData.image1 || null,
        })
        .select()
        .single();

      if (error) throw error;
      result = vendor;
    }

    return result as Vendor;
  } catch (error) {
    console.error("Error upserting vendor:", error);
    return null;
  }
}

// Update vendor by user ID
export async function updateVendorByUserId(
  userId: string,
  updates: Partial<Omit<Vendor, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<Vendor | null> {
  try {
    const { data: vendor, error } = await supabase
      .from('vendors')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating vendor:", error);
      return null;
    }

    return vendor as Vendor;
  } catch (error) {
    console.error("Unexpected error updating vendor:", error);
    return null;
  }
}

// Delete vendor by user ID
export async function deleteVendorByUserId(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error("Error deleting vendor:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Unexpected error deleting vendor:", error);
    return false;
  }
}

// Get vendor by vendor name (search)
export async function getVendorByName(vendorName: string): Promise<Vendor | null> {
  try {
    const { data: vendor, error } = await supabase
      .from('vendors')
      .select('*')
      .ilike('vendor_name', `%${vendorName}%`)
      .maybeSingle();

    if (error) {
      console.error("Error fetching vendor by name:", error);
      return null;
    }

    return vendor as Vendor || null;
  } catch (error) {
    console.error("Unexpected error fetching vendor by name:", error);
    return null;
  }
}

// Get vendors by branch
export async function getVendorsByBranch(branch: string): Promise<Vendor[]> {
  try {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('*')
      .ilike('branch', `%${branch}%`)
      .order('vendor_name', { ascending: true });

    if (error) {
      console.error("Error fetching vendors by branch:", error);
      return [];
    }

    return vendors as Vendor[];
  } catch (error) {
    console.error("Unexpected error fetching vendors by branch:", error);
    return [];
  }
}