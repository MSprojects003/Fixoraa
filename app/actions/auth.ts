// app/actions/auth.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function registerUser(formData: {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  organizationName: string
  branch: string
  address: string
  isGoogleSignup?: boolean
  googleProviderId?: string
}) {
  const supabase = await createClient()
  let userId: string

  if (formData.isGoogleSignup) {
    // For Google signup, get the existing user from auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: 'No user found', success: false }
    }
    userId = user.id
  } else {
    // Regular email/password signup
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
        },
      },
    })

    if (authError) {
      console.error("Auth Error:", authError)
      return { error: authError.message, success: false }
    }

    if (!authData.user) {
      return { error: 'Failed to create user', success: false }
    }

    userId = authData.user.id
  }

  // Insert into users table
  const { error: userError } = await supabase
    .from('users')
    .upsert({
      id: userId,
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone || null,
      is_vendor: true,
      is_customer: false,
      is_deleted: false,
      profile_image: null,
    }, { onConflict: 'id' })

  if (userError) {
    console.error("User Insert Error:", userError)
    return { error: userError.message, success: false }
  }

  // Insert into vendors table
  const { error: vendorError } = await supabase
    .from('vendors')
    .upsert({
      user_id: userId,
      vendor_name: formData.organizationName,
      branch: formData.branch,
      address: formData.address,
      image1: null,
    }, { onConflict: 'user_id' })

  if (vendorError) {
    console.error("Vendor Insert Error:", vendorError)
    return { error: vendorError.message, success: false }
  }

  return { 
    success: true, 
    message: 'Account created successfully!',
    email: formData.email,
    password: formData.password 
  }
}

// Handle Google Sign Up - Creates user and vendor from Google auth
export async function handleGoogleSignUp(vendorData: {
  organizationName: string
  branch: string
  address: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'No user found', success: false }
  }

  // Get user's Google data
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
  const nameParts = fullName.split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''
  const email = user.email || ''
  const avatarUrl = user.user_metadata?.avatar_url || null

  // Insert into users table
  const { error: userError } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: null,
      is_vendor: true,
      is_customer: false,
      is_deleted: false,
      profile_image: avatarUrl,
    }, { onConflict: 'id' })

  if (userError) {
    console.error("User Insert Error:", userError)
    return { error: userError.message, success: false }
  }

  // Insert into vendors table
  const { error: vendorError } = await supabase
    .from('vendors')
    .upsert({
      user_id: user.id,
      vendor_name: vendorData.organizationName,
      branch: vendorData.branch,
      address: vendorData.address,
      image1: null,
    }, { onConflict: 'user_id' })

  if (vendorError) {
    console.error("Vendor Insert Error:", vendorError)
    return { error: vendorError.message, success: false }
  }

  return { success: true }
}

// Ensure user exists and check if vendor is needed
export async function ensureUserAndVendor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'No user found', success: false }
  }

  // Check if user exists in users table
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  // If user doesn't exist, create with Google data
  if (!existingUser) {
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
    const firstName = fullName.split(' ')[0] || ''
    const lastName = fullName.split(' ').slice(1).join(' ') || ''
    const email = user.email || ''

    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: null,
        is_vendor: false,
        is_customer: false,
        is_deleted: false,
        profile_image: user.user_metadata?.avatar_url || null,
      })

    if (userError) {
      console.error("Auto-create user error:", userError)
      return { error: userError.message, success: false }
    }
  }

  // Check if vendor exists
  const { data: existingVendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  // If vendor doesn't exist, return false so we redirect to complete registration
  if (!existingVendor) {
    return { success: false, needsVendor: true }
  }

  return { success: true, needsVendor: false }
}

export async function loginUser(formData: { email: string; password: string }) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  })
  if (error) return { error: error.message }
  
  // Check if user needs vendor data
  const result = await ensureUserAndVendor()
  if (result.needsVendor) {
    redirect('/auth/register')
  }
  redirect('/')
}

export async function logoutUser() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}