// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  
  // Paths that don't require authentication
  const publicPaths = ['/auth/login', '/auth/register', '/auth/callback']
  const isPublicPath = publicPaths.some(publicPath => path === publicPath)

  // Define static assets paths
  const isStaticAsset = path.includes('/_next') || 
                        path.includes('/favicon.ico') || 
                        path.includes('.png') || 
                        path.includes('.jpg') || 
                        path.includes('.svg') ||
                        path.includes('.css') ||
                        path.includes('.js')

  // Skip middleware for static assets
  if (isStaticAsset) {
    return response
  }

  // Redirect to login if not authenticated and trying to access protected route
  if (!user && !isPublicPath) {
    const redirectUrl = new URL('/auth/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect authenticated users away from login only (not onboarding pages)
  if (user && path === '/auth/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}