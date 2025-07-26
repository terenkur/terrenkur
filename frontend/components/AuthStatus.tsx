"use client";

import { supabase } from "@/utils/supabaseClient";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

export default function AuthStatus() {
  const [session, setSession] = useState<Session | null>(null);

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

  const handleLogin = () => {
    supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const username =
    session?.user.user_metadata.preferred_username ||
    session?.user.user_metadata.name ||
    session?.user.user_metadata.full_name ||
    session?.user.user_metadata.nickname ||
    session?.user.email;

  return session ? (
    <div className="flex items-center space-x-2">
      <span className="truncate max-w-xs">{username}</span>
      <button
        className="px-2 py-1 bg-gray-800 text-white rounded"
        onClick={handleLogout}
      >
        Log out
      </button>
    </div>
  ) : (
    <button
      className="px-4 py-2 bg-purple-600 text-white rounded"
      onClick={handleLogin}
    >
      Login with Twitch
    </button>
  );
}
