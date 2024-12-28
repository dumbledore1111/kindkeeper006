import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  try {
    // Try to refresh the session
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    const path = req.nextUrl.pathname
    const publicRoutes = ['/', '/login', '/signup', '/forgot-password']
    const isPublicRoute = publicRoutes.includes(path)

    console.log('Auth Check:', {
      path,
      hasSession: !!session,
      isPublicRoute,
      error: error?.message
    })

    if (!session && !isPublicRoute) {
      // Redirect to login if no session and trying to access protected route
      const redirectUrl = new URL('/login', req.url)
      return NextResponse.redirect(redirectUrl)
    }

    if (session && isPublicRoute) {
      // Redirect to dashboard if has session and trying to access public route
      const redirectUrl = new URL('/dashboard', req.url)
      return NextResponse.redirect(redirectUrl)
    }

    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return res
  }
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/signup',
    '/dashboard',
    '/dashboard/:path*',
    '/forgot-password'
  ]
} 