"use client";
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchMyProfile } from '@/lib/profile';

export default function ModeratorPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const profile = session ? await fetchMyProfile(session) : null;
        if (active) setAllowed(profile?.data?.is_moderator === true);
      } finally { if (active) setChecking(false); }
    };
    void check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { setTimeout(check, 0); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setPassword('');
      if (loginError || !data.session) { setError('Не удалось войти. Проверьте email и пароль.'); return; }
      const profile = await fetchMyProfile(data.session);
      if (!profile.data?.is_moderator) {
        await supabase.auth.signOut({ scope: 'local' });
        setAllowed(false);
        setError('Доступ к управлению не подтверждён. Обратитесь к администратору.');
        return;
      }
      setAllowed(true);
    } catch { setError('Сервис временно недоступен. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setAllowed(false);
    } catch { setError('Не удалось завершить сеанс. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  }
  if (checking) return <p role="status">Проверяем доступ…</p>;
  return <section className="mx-auto max-w-md space-y-5 py-6">
    <h1 className="text-2xl font-semibold">Управление сайтом</h1>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    {allowed ? <>
      <nav className="flex flex-col gap-3">
        <Link href="/">Текущая рулетка</Link>
        <Link href="/new-poll">Создать рулетку</Link>
        <Link href="/games">Управление играми</Link>
        <Link href="/playlists">Плейлисты</Link>
        <Link href="/music-queue">Музыкальная очередь</Link>
        <Link href="/settings">Настройки</Link>
      </nav>
      <button onClick={logout} disabled={busy} className="rounded border px-4 py-2">Выйти</button>
    </> : <form onSubmit={login} className="space-y-4">
      <p className="text-sm text-muted-foreground">Доступ для модераторов.</p>
      <label className="block">Email
        <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded border bg-background p-2" />
      </label>
      <label className="block">Пароль
        <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded border bg-background p-2" />
      </label>
      <button type="submit" disabled={busy} className="rounded bg-purple-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Входим…' : 'Войти'}</button>
      <p className="text-sm text-muted-foreground">Для получения доступа или сброса пароля обратитесь к администратору.</p>
    </form>}
  </section>;
}
