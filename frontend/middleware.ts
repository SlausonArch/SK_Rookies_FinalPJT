import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const APP_MODE = process.env.NEXT_PUBLIC_APP_MODE || 'exchange'

const EXCHANGE_ONLY = ['/crypto', '/exchange', '/balances', '/investments', '/trends', '/community', '/events', '/support', '/admin', '/withdrawal-complete', '/privacy-policy', '/landing']
const BANK_ONLY = ['/bank']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (APP_MODE === 'bank') {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/bank', request.url))
    }
    if (EXCHANGE_ONLY.some(r => pathname === r || pathname.startsWith(r + '/'))) {
      return NextResponse.redirect(new URL('/bank', request.url))
    }
  } else {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/crypto', request.url))
    }
    if (BANK_ONLY.some(r => pathname === r || pathname.startsWith(r + '/'))) {
      return NextResponse.redirect(new URL('/crypto', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
