"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
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
        setAuthError("Missing code parameter");
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
    return <p className="p-4">Login failed: {authError}</p>;
  }

  return <p className="p-4">Logging in...</p>;
}
