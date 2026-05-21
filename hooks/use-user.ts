// hooks/use-user.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  category: string | null;
  image1: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  first_name?: string;
  last_name?: string;
  phone?: string;
}

// Query keys
export const userKeys = {
  all: ["user"] as const,
  current: () => [...userKeys.all, "current"] as const,
  profile: () => [...userKeys.all, "profile"] as const,
  vendor: () => [...userKeys.all, "vendor"] as const,
  allUsers: () => [...userKeys.all, "all"] as const,
};

// User API functions (internal)
const userApi = {
  getCurrentUser: async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error("Error fetching user:", error);
      return null;
    }
    
    return userData as User;
  },

  updateProfile: async (data: Profile): Promise<Profile> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No user found");

    const { data: profile, error } = await supabase
      .from('users')
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
      })
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

// Vendor API functions (internal)
const vendorApi = {
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
        category: data.category,
        address: data.address,
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return vendor as Vendor;
  },

  createVendor: async (data: { vendor_name: string; category: string; address: string }): Promise<Vendor> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No user found");

    const { data: vendor, error } = await supabase
      .from('vendors')
      .insert({
        user_id: user.id,
        vendor_name: data.vendor_name,
        category: data.category,
        address: data.address,
        image1: null,
      })
      .select()
      .single();

    if (error) throw error;
    return vendor as Vendor;
  },
};

// Hook to get current user
export function useCurrentUser() {
  return useQuery({
    queryKey: userKeys.current(),
    queryFn: userApi.getCurrentUser,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to get vendor
export function useVendor() {
  return useQuery({
    queryKey: userKeys.vendor(),
    queryFn: vendorApi.getVendor,
    enabled: true,
  });
}

// Hook to update user profile
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.current() });
      queryClient.invalidateQueries({ queryKey: userKeys.profile() });
    },
  });
}

// Hook to update vendor
export function useUpdateVendor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: vendorApi.updateVendor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.vendor() });
    },
  });
}

// Hook to create vendor
export function useCreateVendor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: vendorApi.createVendor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.vendor() });
      queryClient.invalidateQueries({ queryKey: userKeys.current() });
    },
  });
}

// Hook to get all users (admin only)
export function useAllUsers() {
  return useQuery({
    queryKey: userKeys.allUsers(),
    queryFn: userApi.getAllUsers,
    enabled: false,
  });
}
