// lib/api/user.ts (Client-safe - can be imported anywhere)
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Types
export interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  profile_image: string | null;
  is_vendor: boolean;
  is_customer: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

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

// User API functions (client-safe)
export const userApi = {
  getCurrentUser: async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) return null;
    return userData as User;
  },

  updateProfile: async (data: { first_name?: string; last_name?: string; phone?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No user found");

    const { data: profile, error } = await supabase
      .from('users')
      .update(data)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return profile;
  },

  getAllUsers: async (): Promise<User[]> => {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_deleted', false);

    if (error) throw error;
    return users as User[];
  },
};

// Vendor API functions (client-safe)
export const vendorApi = {
  getVendor: async (): Promise<Vendor | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: vendor, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') return null;
    return vendor as Vendor || null;
  },

  updateVendor: async (data: Partial<Vendor>): Promise<Vendor> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No user found");

    const { data: vendor, error } = await supabase
      .from('vendors')
      .update({
        vendor_name: data.vendor_name,
        branch: data.branch,
        address: data.address,
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return vendor as Vendor;
  },

  createVendor: async (data: { vendor_name: string; branch: string; address: string }): Promise<Vendor> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No user found");

    const { data: vendor, error } = await supabase
      .from('vendors')
      .insert({
        user_id: user.id,
        vendor_name: data.vendor_name,
        branch: data.branch,
        address: data.address,
        image1: null,
      })
      .select()
      .single();

    if (error) throw error;
    return vendor as Vendor;
  },
};

// Registration function (uses server-only functions via Server Action)
// Note: This function should be called from a Server Action, not directly from client
export const registerUserClient = async (formData: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  organizationName: string;
  branch: string;
  address: string;
}) => {
  // This will call a Server Action
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return await response.json();
};