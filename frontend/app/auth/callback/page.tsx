"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const exchanged = useRef(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const exchange = async () => {
      if (exchanged.current) return;
      exchanged.current = true;
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
        console.error(error.message);
        if (error.message.toLowerCase().includes("code verifier")) {
          setAuthError("Missing code verifier. Please restart the login flow.");
          return;
        }
        setAuthError(error.message);
        return;
      }

      router.replace("/");
    };
    exchange();
  }, [router]);

  if (authError) {
    return <p className="p-4">Login failed: {authError}</p>;
  }

  return <p className="p-4">Logging in...</p>;
}
