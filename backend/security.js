const { timingSafeEqual } = require('node:crypto');

function isModeratorFromAuth(user) {
  return user?.app_metadata?.is_moderator === true ||
    user?.app_metadata?.role === 'moderator' ||
    (Array.isArray(user?.app_metadata?.roles) && user.app_metadata.roles.includes('moderator'));
}

function requireAdminToken(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  const actual = req.headers['x-admin-token'];
  if (!expected || typeof actual !== 'string') return res.status(403).json({ error: 'Forbidden' });
  const a = Buffer.from(actual), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(403).json({ error: 'Forbidden' });
  next();
}

function createSecurity(supabase, getTwitchToken) {
  async function requireAuth(req, res, next) {
    const token = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) return res.status(401).json({ error: 'Invalid session' });
      req.authUser = data.user;
      res.set('Cache-Control', 'no-store');
      return next();
    } catch {
      return res.status(503).json({ error: 'Authentication unavailable' });
    }
  }

  // Resolve the immutable OAuth identity through Twitch, never user_metadata or a request nickname.
  async function verifiedLogin(user) {
    const identity = user.identities?.find((entry) => entry.provider === 'twitch');
    const id = identity?.provider_id || identity?.identity_data?.sub;
    if (!id || !/^\d+$/.test(String(id))) throw Object.assign(new Error('Verified Twitch identity required'), { status: 403 });
    const token = await getTwitchToken();
    const resp = await fetch(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(id)}`, {
      headers: { 'Client-ID': process.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw Object.assign(new Error('Twitch identity lookup unavailable'), { status: 502 });
    const info = (await resp.json()).data?.[0];
    if (String(info?.id) !== String(id) || !/^[a-z0-9_]{1,25}$/.test(info?.login || '')) {
      throw Object.assign(new Error('Verified Twitch identity required'), { status: 403 });
    }
    return info.login;
  }

  async function ensureProfile(user) {
    const existing = await supabase.from('users').select('*').eq('auth_id', user.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return existing.data;
    const login = await verifiedLogin(user);
    const escapedLogin = login.replace(/_/g, '\\_');
    const found = await supabase.from('users').select('*')
      .or(`username.ilike.${escapedLogin},twitch_login.eq.${login}`).maybeSingle();
    if (found.error) throw found.error;
    if (found.data?.auth_id) {
      if (found.data.auth_id === user.id) return found.data;
      throw Object.assign(new Error('Profile already linked to another account'), { status: 409 });
    }
    const result = found.data
      ? await supabase.from('users').update({ auth_id: user.id, twitch_login: login })
          .eq('id', found.data.id).is('auth_id', null).select('*').maybeSingle()
      : await supabase.from('users').insert({ auth_id: user.id, username: login, twitch_login: login })
          .select('*').maybeSingle();
    if (result.error || !result.data) {
      // A simultaneous login may have completed the same binding. Never overwrite its owner.
      const retry = await supabase.from('users').select('*').eq('auth_id', user.id).maybeSingle();
      if (!retry.error && retry.data) return retry.data;
      throw Object.assign(new Error('Profile could not be linked; retry sign-in'), { status: 409 });
    }
    return result.data;
  }
  return { requireAuth, ensureProfile };
}

module.exports = { createSecurity, isModeratorFromAuth, requireAdminToken };
