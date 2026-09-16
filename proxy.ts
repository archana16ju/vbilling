import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const role = request.cookies.get('auth_role')?.value;
  const path = request.nextUrl.pathname;

  // Protect dashboard routes
  if (path.startsWith('/dashboard') || path.startsWith('/categories') || path.startsWith('/products')) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Protect terminal route
  if (path.startsWith('/terminal')) {
    if (role !== 'admin' && role !== 'cashier') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Redirect root to login
  if (path === '/') {
    if (role === 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else if (role === 'cashier') {
      return NextResponse.redirect(new URL('/terminal', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If already logged in, redirect away from login
  if (path === '/login') {
    if (role === 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else if (role === 'cashier') {
      return NextResponse.redirect(new URL('/terminal', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
