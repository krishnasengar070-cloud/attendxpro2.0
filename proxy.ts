import { NextRequest, NextResponse } from 'next/server';
export function proxy(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const websocket = process.env.REALTIME_URL ? new URL(process.env.REALTIME_URL).origin : '';
  const dev = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}'${dev}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ${websocket}; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;
  const h = new Headers(req.headers);
  h.set('x-nonce', nonce);
  h.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers: h } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}
export const config = { matcher: ['/((?!api/|_next/|.*\\..*).*)'] };
