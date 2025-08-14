"use client";

import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  return (
    <select
      aria-label={t('language')}
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="border rounded p-1 bg-background text-foreground"
    >
      <option value="en">{t('english')}</option>
      <option value="ru">{t('russian')}</option>
    </select>
  );
}
