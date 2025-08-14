import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

const SUPPORTED_LOCALES = ['en', 'ru'] as const;
const DEFAULT_LOCALE = 'en';
const LANGUAGE_COOKIE = 'i18nextLng';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const cookieStore = await cookies();
  let locale =
    cookieStore.get(LANGUAGE_COOKIE)?.value as
      | typeof SUPPORTED_LOCALES[number]
      | undefined;

  if (!locale || !SUPPORTED_LOCALES.includes(locale)) {
    const accept = (await headers()).get('accept-language') || '';
    const headerLocale = accept.split(',')[0]?.split('-')[0];
    if (headerLocale && SUPPORTED_LOCALES.includes(headerLocale as typeof SUPPORTED_LOCALES[number])) {
      locale = headerLocale as typeof SUPPORTED_LOCALES[number];
    } else {
      locale = DEFAULT_LOCALE;
    }
    cookieStore.set(LANGUAGE_COOKIE, locale);
  }

  redirect(`/${locale}`);
}

