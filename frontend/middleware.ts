import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'ru'] as const;
const DEFAULT_LOCALE = 'en';
const LANGUAGE_COOKIE = 'i18nextLng';

export function middleware(request: NextRequest) {
  let locale = request.cookies.get(LANGUAGE_COOKIE)?.value as
    | (typeof SUPPORTED_LOCALES)[number]
    | undefined;
  let shouldSetCookie = false;

  if (!locale || !SUPPORTED_LOCALES.includes(locale)) {
    const accept = request.headers.get('accept-language') || '';
    const headerLocale = accept.split(',')[0]?.split('-')[0];
    if (
      headerLocale &&
      SUPPORTED_LOCALES.includes(
        headerLocale as (typeof SUPPORTED_LOCALES)[number]
      )
    ) {
      locale = headerLocale as (typeof SUPPORTED_LOCALES)[number];
    } else {
      locale = DEFAULT_LOCALE;
    }
    shouldSetCookie = true;
  }

  const response = NextResponse.redirect(new URL(`/${locale}`, request.url));
  if (shouldSetCookie) {
    response.cookies.set(LANGUAGE_COOKIE, locale);
  }
  return response;
}

export const config = {
  matcher: '/',
};
