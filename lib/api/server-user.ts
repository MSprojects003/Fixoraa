// lib/api/server-user.ts (Server-only file - DO NOT import in client components)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// This file can only be imported in Server Components and Server Actions

export async function getSupabaseAdmin() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Handle error
          }
        },
      },
    }
  )
}

export async function createUser(data: {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_vendor: boolean;
  is_customer: boolean;
}) {
  const supabaseAdmin = await getSupabaseAdmin()
  
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .insert({
      id: data.id,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      is_vendor: data.is_vendor,
      is_customer: data.is_customer,
      is_deleted: false,
      profile_image: null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return user;
}

export async function createVendorRecord(data: {
  user_id: string;
  vendor_name: string;
  branch: string;
  address: string;
}) {
  const supabaseAdmin = await getSupabaseAdmin()
  
  const { data: vendor, error } = await supabaseAdmin
    .from('vendors')
    .insert({
      user_id: data.user_id,
      vendor_name: data.vendor_name,
      branch: data.branch,
      address: data.address,
      image1: null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return vendor;
}