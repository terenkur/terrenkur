"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchMyProfile } from '@/lib/profile';
export default function ModeratorStatus() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let version = 0;
    const check = async () => {
      const current = ++version;
      setAllowed(false);
      const { data: { session } } = await supabase.auth.getSession();
      const profile = session ? await fetchMyProfile(session) : null;
      if (current === version) setAllowed(profile?.data?.is_moderator === true);
    };
    void check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { setTimeout(check, 0); });
    return () => { version++; subscription.unsubscribe(); };
  }, []);
  return allowed ? <Link href="/moderator" className="text-sm underline">Управление</Link> : null;
}
