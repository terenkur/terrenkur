"use client";

import { supabase } from "@/utils/supabaseClient";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
    };
    loadSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = () => {
    supabase.auth.signInWithOAuth({ provider: "twitch" });
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center space-y-4">
      <h1 className="text-2xl font-semibold">Welcome to Terrenkur</h1>
      {session ? (
        <>
          <p className="text-lg">Logged in as {username}</p>
          <button
            className="px-4 py-2 bg-gray-800 text-white rounded"
            onClick={handleLogout}
          >
            Log out
          </button>
        </>
      ) : (
        <button
          className="px-4 py-2 bg-purple-600 text-white rounded"
          onClick={handleLogin}
        >
          Login with Twitch
        </button>
      )}
    </main>
  );
}
