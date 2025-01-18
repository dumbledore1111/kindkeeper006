import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Minimal middleware that just passes through requests
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

// Empty matcher means middleware won't run on any routes
export const config = {
  matcher: []
} 