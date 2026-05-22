import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyTokenEdge } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public paths pass
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/share/') ||
    (pathname.startsWith('/api/auth/') && pathname !== '/api/auth/me') ||
    pathname.startsWith('/api/share/') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    // If user is already logged in and tries to access /login, redirect to /
    if (pathname.startsWith('/login')) {
      const token = request.cookies.get('token')?.value;
      if (token) {
        const decoded = await verifyTokenEdge(token);
        if (decoded) {
          return NextResponse.redirect(new URL('/', request.url));
        }
      }
    }
    return NextResponse.next();
  }

  // Protect all other routes (/, /gm, /api/characters, etc.)
  const token = request.cookies.get('token')?.value;
  if (!token) {
    // API routes return 401 Unauthorized
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    // HTML pages redirect to /login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const decoded = await verifyTokenEdge(token);
  if (!decoded) {
    // Clear cookie and redirect to login if token is invalid
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    
    response.cookies.set('token', '', { maxAge: 0 });
    return response;
  }

  // Inject standard headers with decoded credentials for Route Handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', String(decoded.userId));
  requestHeaders.set('x-user-username', decoded.username);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
