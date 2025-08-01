"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const exchanged = useRef(false);

  useEffect(() => {
    const exchange = async () => {
      if (exchanged.current) return;
      exchanged.current = true;
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
