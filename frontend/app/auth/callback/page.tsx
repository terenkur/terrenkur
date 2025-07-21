"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const exchange = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        await (supabase.auth as any).exchangeCodeForSession(code);
      }
      router.replace("/");
    };
    exchange();
  }, [router]);

  return <p className="p-4">Logging in...</p>;
}
