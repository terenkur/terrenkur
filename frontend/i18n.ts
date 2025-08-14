import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ru from './locales/ru.json';

const SUPPORTED_LOCALES = ['ru'] as const;
const LANGUAGE_COOKIE = 'i18nextLng';

function detectLocale(): (typeof SUPPORTED_LOCALES)[number] {
  return SUPPORTED_LOCALES[0];
}

const locale = detectLocale();

if (typeof document !== 'undefined') {
  document.cookie = `${LANGUAGE_COOKIE}=${locale}; path=/`;
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
    },
    lng: 'ru',
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.cookie = `${LANGUAGE_COOKIE}=${lng}; path=/`;
  }
});

export default i18n;
