import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.get('i18nextLng')) {
    response.cookies.set('i18nextLng', 'ru');
  }
  return response;
}

export const config = {
  matcher: '/',
};
