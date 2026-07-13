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
  nic_pic: string | null;
  nic_verified: boolean | null;
  vo_certificate: string | null;
  vo_verified: boolean | null;
  status: string | null;
  nic_back: string | null;
  subscription_type: string | null;
  has_subscription: boolean | null;
  edit_tracking: string | null;
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
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;
    
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    // If no user record in database, create one from auth metadata
    if (error || !userData) {
      console.log("[v0] No user record found, creating from auth metadata");
      
      // Extract name from Google OAuth metadata
      const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || "";
      const nameParts = fullName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      
      // Return user object with auth data
      return {
        id: authUser.id,
        first_name: firstName,
        last_name: lastName,
        email: authUser.email || "",
        phone: authUser.phone || null,
        profile_image: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
        is_vendor: false,
        is_customer: true,
        is_deleted: false,
        created_at: authUser.created_at,
        updated_at: authUser.updated_at,
      } as User;
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
    if (!user) {
      console.error("[v0] No authenticated user found for vendor creation");
      throw new Error("No user found - please log in");
    }

    console.log("[v0] Creating vendor for user:", user.id);
    console.log("[v0] Vendor data:", data);

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

    if (error) {
      console.error("[v0] Vendor create error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }
    
    console.log("[v0] Vendor created successfully:", vendor);
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
