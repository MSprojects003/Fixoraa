import { createClient as createBrowserClient } from '@/lib/supabase/client';

export interface CustomerDetails {
  id: string;
  userId: string;
  fullName: string;
  email: string | null;
  profileImage: string | null;
  address: string | null;
  city: string | null;
  deliveryAddress: Record<string, unknown> | null;
  phone: string | null;
  preferredLanguage: string | null;
  isActive: boolean;
  createdAt: string;
}

async function createSupabaseClient() {
  if (typeof window !== 'undefined') {
    return createBrowserClient();
  }

  const [{ cookies }, { createServerClient }] = await Promise.all([
    import('next/headers'),
    import('@supabase/ssr'),
  ]);

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
}

export const customerApi = {
  async getCustomerByUserId(userId: string): Promise<CustomerDetails | null> {
    const supabase = await createSupabaseClient();

    const { data, error } = await supabase
      .from('customers')
      .select(`
        id,
        user_id,
        address,
        city,
        delivery_address,
        phone,
        preferred_language,
        is_active,
        created_at,
        user:users!customers_user_id_fkey (
          first_name,
          last_name,
          email,
          profile_image
        )
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Customer detail fetch error:', error);
      return null;
    }

    if (!data) return null;

    const userData = Array.isArray(data.user) ? data.user[0] : data.user;
    const fullName = [userData?.first_name?.trim(), userData?.last_name?.trim()]
      .filter(Boolean)
      .join(' ') || userData?.email || 'Unknown Customer';

    return {
      id: data.id,
      userId: data.user_id,
      fullName,
      email: userData?.email ?? null,
      profileImage: userData?.profile_image ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      deliveryAddress: data.delivery_address
        ? (typeof data.delivery_address === 'string'
            ? JSON.parse(data.delivery_address)
            : data.delivery_address)
        : null,
      phone: data.phone ?? null,
      preferredLanguage: data.preferred_language ?? null,
      isActive: data.is_active ?? true,
      createdAt: data.created_at,
    };
  },
};

export async function fetchCustomerById(
  customerId: string | null | undefined
): Promise<CustomerDetails | null> {
  if (!customerId) return null;

  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from('customers')
    .select(`
      id,
      user_id,
      address,
      city,
      delivery_address,
      phone,
      preferred_language,
      is_active,
      created_at,
      user:users!customers_user_id_fkey (
        first_name,
        last_name,
        email,
        profile_image
      )
    `)
    .eq('id', customerId)
    .single();

  if (error) {
    console.error('Customer fetch error:', error);
    return null;
  }

  if (!data) return null;

  const userData = Array.isArray(data.user) ? data.user[0] : data.user;

  const fullName = [userData?.first_name?.trim(), userData?.last_name?.trim()]
    .filter(Boolean)
    .join(' ') || userData?.email || 'Unknown Customer';

  return {
    id: data.id,
    userId: data.user_id,
    fullName,
    email: userData?.email ?? null,
    profileImage: userData?.profile_image ?? null,
    address: data.address ?? null,
    city: data.city ?? null,
    deliveryAddress: data.delivery_address
      ? (typeof data.delivery_address === 'string'
          ? JSON.parse(data.delivery_address)
          : data.delivery_address)
      : null,
    phone: data.phone ?? null,
    preferredLanguage: data.preferred_language ?? null,
    isActive: data.is_active ?? true,
    createdAt: data.created_at,
  };
}

export interface CustomerListItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  city: string | null;
  address: string | null;
  joinedAt: string;
  email?: string | null;
}

export interface DashboardCustomer {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  isActive: boolean;
}

export async function fetchCustomersForDashboard(): Promise<DashboardCustomer[]> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from('customers')
    .select(`
      id,
      is_active,
      created_at,
      user:users!customers_user_id_fkey (
        first_name,
        last_name,
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Dashboard customer fetch error:', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const user = Array.isArray(row.user) ? row.user[0] : row.user;
    const fullName = [user?.first_name?.trim(), user?.last_name?.trim()]
      .filter(Boolean)
      .join(' ')
      .trim() || user?.email || 'Unknown Customer';

    return {
      id: row.id,
      name: fullName,
      email: user?.email ?? null,
      createdAt: row.created_at,
      isActive: row.is_active ?? true,
    };
  });
}

export async function fetchAllCustomers(): Promise<CustomerListItem[]> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from('customers')
    .select(`
      id,
      address,
      city,
      created_at,
      user:users!customers_user_id_fkey (
        first_name,
        last_name,
        email
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch customers:', error.message);
    return [];
  }

  if (!data) return [];

  return data.map((row: any) => {
    const user = Array.isArray(row.user) ? row.user[0] : row.user;

    const firstName = user?.first_name?.trim() ?? null;
    const lastName = user?.last_name?.trim() ?? null;

    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || user?.email || 'Unknown Customer';

    return {
      id: row.id,
      firstName,
      lastName,
      fullName,
      city: row.city ?? null,
      address: row.address ?? null,
      joinedAt: row.created_at,
      email: user?.email ?? null,
    };
  });
}