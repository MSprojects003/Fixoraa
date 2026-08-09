// lib/api/vendor.ts
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Types
export interface Vendor {
  id: string;
  user_id: string;
  vendor_name: string | null;
  branch: string | null;
  category: string | null;
  image1: string | null;
  address: string | null;
  nic_pic: string | null;
  nic_back: string | null;  // Added NIC back field
  nic_verified: boolean | null;
  vo_certificate: string | null;
  vo_verified: boolean | null;
  status: string | null;
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

// Get active vendors (for public listing)
export async function getActiveVendors(): Promise<Vendor[]> {
  try {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('status', 'active')
      .order('vendor_name', { ascending: true });

    if (error) {
      console.error("Error fetching active vendors:", error);
      return [];
    }

    return vendors as Vendor[];
  } catch (error) {
    console.error("Unexpected error fetching active vendors:", error);
    return [];
  }
}

// Create or update vendor (upsert)
export async function upsertVendor(vendorData: {
  user_id: string;
  vendor_name?: string;
  branch?: string;
  category?: string;
  address?: string;
  image1?: string | null;
  nic_pic?: string | null;
  nic_back?: string | null;  // Added NIC back field
  nic_verified?: boolean;
  vo_certificate?: string | null;
  vo_verified?: boolean;
  status?: string;
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
          category: vendorData.category ?? existingVendor.category,
          address: vendorData.address ?? existingVendor.address,
          image1: vendorData.image1 !== undefined ? vendorData.image1 : existingVendor.image1,
          nic_pic: vendorData.nic_pic !== undefined ? vendorData.nic_pic : existingVendor.nic_pic,
          nic_back: vendorData.nic_back !== undefined ? vendorData.nic_back : existingVendor.nic_back,  // Added NIC back
          nic_verified: vendorData.nic_verified !== undefined ? vendorData.nic_verified : existingVendor.nic_verified,
          vo_certificate: vendorData.vo_certificate !== undefined ? vendorData.vo_certificate : existingVendor.vo_certificate,
          vo_verified: vendorData.vo_verified !== undefined ? vendorData.vo_verified : existingVendor.vo_verified,
          status: vendorData.status ?? existingVendor.status,
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
          category: vendorData.category || null,
          address: vendorData.address || null,
          image1: vendorData.image1 || null,
          nic_pic: vendorData.nic_pic || null,
          nic_back: vendorData.nic_back || null,  // Added NIC back
          nic_verified: vendorData.nic_verified || false,
          vo_certificate: vendorData.vo_certificate || null,
          vo_verified: vendorData.vo_verified || false,
          status: vendorData.status || 'pending',
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

// Update vendor verification status
export async function updateVendorVerification(
  userId: string,
  verificationData: {
    nic_verified?: boolean;
    vo_verified?: boolean;
    status?: string;
  }
): Promise<Vendor | null> {
  try {
    const { data: vendor, error } = await supabase
      .from('vendors')
      .update({
        ...verificationData,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating vendor verification:", error);
      return null;
    }

    return vendor as Vendor;
  } catch (error) {
    console.error("Unexpected error updating vendor verification:", error);
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

// Get vendors by category
export async function getVendorsByCategory(category: string): Promise<Vendor[]> {
  try {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('*')
      .ilike('category', `%${category}%`)
      .eq('status', 'active')
      .order('vendor_name', { ascending: true });

    if (error) {
      console.error("Error fetching vendors by category:", error);
      return [];
    }

    return vendors as Vendor[];
  } catch (error) {
    console.error("Unexpected error fetching vendors by category:", error);
    return [];
  }
}

// Get vendors by status
export async function getVendorsByStatus(status: string): Promise<Vendor[]> {
  try {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching vendors by status:", error);
      return [];
    }

    return vendors as Vendor[];
  } catch (error) {
    console.error("Unexpected error fetching vendors by status:", error);
    return [];
  }
}

// Get vendors with pending verification
export async function getPendingVerificationVendors(): Promise<Vendor[]> {
  try {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('*')
      .or('nic_verified.eq.false,vo_verified.eq.false')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching pending verification vendors:", error);
      return [];
    }

    return vendors as Vendor[];
  } catch (error) {
    console.error("Unexpected error fetching pending verification vendors:", error);
    return [];
  }
}

// Get vendors with both NIC front and back uploaded
export async function getVendorsWithNICComplete(): Promise<Vendor[]> {
  try {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('*')
      .not('nic_pic', 'is', null)
      .not('nic_back', 'is', null)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching vendors with complete NIC:", error);
      return [];
    }

    return vendors as Vendor[];
  } catch (error) {
    console.error("Unexpected error fetching vendors with complete NIC:", error);
    return [];
  }
}

// Get vendors with missing NIC back
export async function getVendorsWithMissingNICBack(): Promise<Vendor[]> {
  try {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('*')
      .not('nic_pic', 'is', null)
      .is('nic_back', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching vendors with missing NIC back:", error);
      return [];
    }

    return vendors as Vendor[];
  } catch (error) {
    console.error("Unexpected error fetching vendors with missing NIC back:", error);
    return [];
  }
}