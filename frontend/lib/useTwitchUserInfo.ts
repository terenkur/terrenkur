import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchTwitchRoles } from './twitchRoles';

export function useTwitchUserInfo(twitchLogin: string | null) {
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const infoErrorText = t('twitchInfoFetchFailed');
  const enabled = process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES === 'true';
  useEffect(() => {
    setProfileUrl(null); setRoles([]); setError(null);
    if (!twitchLogin || !enabled) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetchTwitchRoles(twitchLogin, controller.signal).then((info) => {
      if (controller.signal.aborted) return;
      setProfileUrl(info.profileImageUrl); setRoles(info.roles);
    }).catch(() => {
      if (!controller.signal.aborted) setError(infoErrorText);
    }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [twitchLogin, enabled, infoErrorText]);
  return { profileUrl, roles, error };
}
