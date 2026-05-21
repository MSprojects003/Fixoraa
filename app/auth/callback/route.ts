// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const from = requestUrl.searchParams.get('from') // 👈 Read the 'from' param

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Use maybeSingle() to avoid PGRST116 errors on empty tables
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle() // 👈 was .single()

      if (!existingUser) {
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
        const firstName = fullName.split(' ')[0] || ''
        const lastName = fullName.split(' ').slice(1).join(' ') || ''

        await supabase.from('users').insert({
          id: user.id,
          first_name: firstName,
          last_name: lastName,
          email: user.email,
          phone: null,
          is_vendor: false,
          is_customer: false,
          is_deleted: false,
          profile_image: user.user_metadata?.avatar_url || null,
        })
      }

      const { data: existingVendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle() // 👈 was .single()

      if (!existingVendor) {
        // 👇 KEY FIX: If coming from register flow, go to process-google-signup
        // so that sessionStorage vendor data is consumed and saved.
        if (from === 'register') {
          return NextResponse.redirect(
            new URL('/auth/process-google-signup', requestUrl.origin)
          )
        }

        // Coming from login flow — redirect to register with prefilled params
        const redirectUrl = new URL('/auth/register', requestUrl.origin)
        redirectUrl.searchParams.set('google_signup', 'true')
        redirectUrl.searchParams.set('email', user.email || '')

        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
        const firstName = fullName.split(' ')[0] || ''
        const lastName = fullName.split(' ').slice(1).join(' ') || ''
        redirectUrl.searchParams.set('firstName', firstName)
        redirectUrl.searchParams.set('lastName', lastName)

        return NextResponse.redirect(redirectUrl)
      }

      return NextResponse.redirect(new URL('/', requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL('/auth/login', requestUrl.origin))
}