"use client";

import { fetchMyProfile } from "@/lib/profile";

import { supabase } from "@/lib/supabase";
import { useEffect, useState, useRef } from "react";
import { storeProviderToken } from "@/lib/twitch";
import { fetchTwitchRoles } from "@/lib/twitchRoles";
import { Button } from "@/components/ui/button";
import { ROLE_ICONS, getSubBadge } from "@/lib/roleIcons";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { useTranslation } from "react-i18next";

import type { Session } from "@supabase/supabase-js";

export default function AuthStatus() {
  const { t } = useTranslation();
  const infoErrorText = t('twitchInfoFetchFailed');
  const [session, setSession] = useState<Session | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [subMonths, setSubMonths] = useState<number>(0);
  const [scopeWarning, setScopeWarning] = useState<string | null>(null);
  const rolesEnabled =
    process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES === "true";
  const prevSessionRef = useRef<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        setSession(sess);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchId = async () => {
      if (!session) {
        setUserId(null);
        return;
      }
      const { data } = await fetchMyProfile(session);
      setUserId(data?.id ?? null);
      setSubMonths(data?.total_months_subbed ?? 0);
    };
    fetchId();
  }, [session]);

  // Persist the provider token for page reloads
  useEffect(() => {
    const prevSession = prevSessionRef.current;
    if (!session) {
      if (prevSession) {
        storeProviderToken(undefined);
      }
    } else {
      const token = (session as any)?.provider_token as string | undefined;
      if (token) {
        storeProviderToken(token);
      }
    }
    prevSessionRef.current = session;
  }, [session]);

  useEffect(() => {
    setProfileUrl(null);
    setRoles([]);
    setScopeWarning(null);
    if (!rolesEnabled || !session) return;
    const login = session.user.user_metadata?.preferred_username || session.user.user_metadata?.name;
    if (typeof login !== 'string') return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetchTwitchRoles(login, controller.signal).then((info) => {
      if (controller.signal.aborted) return;
      setProfileUrl(info.profileImageUrl);
      setRoles(info.roles);
    }).catch(() => {
      if (!controller.signal.aborted) setScopeWarning(infoErrorText);
    }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [session, rolesEnabled, infoErrorText]);

  const debugPkceCheck = () => {
    if (process.env.NODE_ENV === "production") return;
    const hasCvKey = Object.keys(localStorage).some((key) =>
      key.startsWith("sb-cv-")
    );
    if (!hasCvKey) {
      const msg = t('missingPkce');
      console.warn(msg);
      try {
        alert(msg);
      } catch {
        /* no-op */
      }
    }
  };

  const handleLogin = async () => {
    const scopes = "user:read:email";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes,
      },
    });
    setTimeout(debugPkceCheck, 500);
    if (error) {
      console.error("OAuth login error", error);
      alert(t('oauthError', { error: error.message }));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    storeProviderToken(undefined);
  };

  const username =
    session?.user.user_metadata.preferred_username ||
    session?.user.user_metadata.name ||
    session?.user.user_metadata.full_name ||
    session?.user.user_metadata.nickname ||
    session?.user.email;

  const subBadge = getSubBadge(subMonths);

  const TwitchAuthButton = ({ label }: { label: string }) => (
    <Button
      onClick={handleLogin}
      size="icon"
      aria-label={label}
      className="sm:w-auto sm:px-4"
    >
      <Image
        src="/icons/socials/twitch.svg"
        alt="Twitch"
        width={24}
        height={24}
        className="w-6 h-6 invert"
        priority
      />
      <span className="hidden sm:inline ml-2">{label}</span>
    </Button>
  );

  const scopeWarningContent =
    rolesEnabled && scopeWarning && session ? (
      <div className="mt-2 flex flex-col sm:flex-row sm:items-center">
        <TwitchAuthButton label={t('loginWithTwitch')} />
      </div>
    ) : null;

  return session ? (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center space-x-2">
            <span className="flex items-center space-x-1 truncate max-w-xs">
              {rolesEnabled &&
                roles.length > 0 &&
                roles.map((r) =>
                  r === "Sub"
                    ? subBadge
                      ? (
                          <Image
                            key={r}
                            src={subBadge}
                            alt={t(`roles.${r}`)}
                            width={16}
                            height={16}
                            className="w-4 h-4"
                            loading="lazy"
                          />
                        )
                      : null
                    : ROLE_ICONS[r]
                    ? (
                        <Image
                          key={r}
                          src={ROLE_ICONS[r]}
                          alt={t(`roles.${r}`)}
                          width={16}
                          height={16}
                          className="w-4 h-4"
                          loading="lazy"
                        />
                      )
                    : null
                )}
              {username}
            </span>
            {profileUrl && (
              <Image
                src={profileUrl}
                alt={t('profile')}
                width={24}
                height={24}
                className="w-6 h-6 rounded-full"
                priority
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {userId && (
            <DropdownMenuItem asChild>
              <Link href={`/users/${userId}`}>{t('profile')}</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={handleLogout}>
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {scopeWarningContent}
    </>
  ) : (
    <>
      <TwitchAuthButton label={t('loginWithTwitch')} />
      {scopeWarningContent}
    </>
  );
}
