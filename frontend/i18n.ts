import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ru from './locales/ru.json';

const SUPPORTED_LOCALES = ['en', 'ru'] as const;
const LANGUAGE_COOKIE = 'i18nextLng';

function detectLocale(): string {
  if (typeof window === 'undefined') return 'en';

  const cookieMatch = document.cookie.match(new RegExp(`${LANGUAGE_COOKIE}=([^;]+)`));
  if (cookieMatch && SUPPORTED_LOCALES.includes(cookieMatch[1] as (typeof SUPPORTED_LOCALES)[number])) {
    return cookieMatch[1];
  }

  const pathLocale = window.location.pathname.split('/')[1];
  if (SUPPORTED_LOCALES.includes(pathLocale as (typeof SUPPORTED_LOCALES)[number])) {
    return pathLocale;
  }

  const navLang =
    (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
  const lang = navLang.split('-')[0];
  if (SUPPORTED_LOCALES.includes(lang as (typeof SUPPORTED_LOCALES)[number])) {
    return lang;
  }

  return 'en';
}

const locale = detectLocale();

if (typeof document !== 'undefined') {
  document.cookie = `${LANGUAGE_COOKIE}=${locale}; path=/`;
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    lng: locale,
    fallbackLng: locale,
    interpolation: { escapeValue: false },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.cookie = `${LANGUAGE_COOKIE}=${lng}; path=/`;
  }
});

export default i18n;
