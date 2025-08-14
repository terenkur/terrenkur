"use client";

import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { i18n, t } = useTranslation();

  return (
    <select
      aria-label={t('language')}
      value={i18n.language}
      onChange={(e) => {
        const segments = pathname.split('/').filter(Boolean);
        segments[0] = e.target.value;
        router.replace(`/${segments.join('/')}`);
      }}
      className="border rounded p-1 bg-background text-foreground"
    >
      <option value="en">{t('english')}</option>
      <option value="ru">{t('russian')}</option>
    </select>
  );
}
