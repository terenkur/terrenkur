"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const { t } = useTranslation();
  const exchanged = useRef(false);
  const loggedError = useRef<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const exchange = async () => {
      if (exchanged.current) return;
      exchanged.current = true;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.replace("/");
        return;
      }

      const url = new URL(window.location.href);

      let code = url.searchParams.get("code");
      if (!code) {
        const hashParams = new URLSearchParams(url.hash.slice(1));
        code = hashParams.get("code");
      }

      if (!code) {
        setAuthError(t("missingCode"));
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        if (error.message.toLowerCase().includes("code verifier")) {
          await supabase.auth.signOut();
          router.replace("/");
          return;
        }
        setAuthError(error.message);
        return;
      }

      router.replace("/");
    };
    exchange();
  }, [router]);

  useEffect(() => {
    if (authError && loggedError.current !== authError) {
      console.error(authError);
      loggedError.current = authError;
    }
  }, [authError]);

  if (authError) {
    return <p className="p-4">{t("loginFailed", { error: authError })}</p>;
  }

  return <p className="p-4">{t("loggingIn")}</p>;
}
