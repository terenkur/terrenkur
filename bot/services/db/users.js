const {
  intim: INTIM_COLUMNS,
  poceluy: POCELUY_COLUMNS,
} = require('../../../shared/intimPoceluyTypes.json');

const ACHIEVEMENT_THRESHOLDS = {
  total_streams_watched: [10],
  total_subs_gifted: [5],
  total_subs_received: [5],
  total_chat_messages_sent: [500, 1000, 2000],
  total_times_tagged: [10],
  total_commands_run: [20],
  total_months_subbed: [3],
  total_watch_time: [60, 120, 240, 600, 1800, 3000],
  message_count: [20, 50, 100],
  first_message: [1],
  clips_created: [1],
  combo_commands: [1],
};

for (const col of [...INTIM_COLUMNS, ...POCELUY_COLUMNS]) {
  ACHIEVEMENT_THRESHOLDS[col] = [5];
}

function normalizeUsername(value = '') {
  return value.trim().toLowerCase();
}

function createUserService({ supabase, getTwitchToken, getStreamerToken, twitchConfig }) {
  if (!supabase) {
    throw new Error('User service requires supabase client');
  }

  async function ensureUserAffinity(user) {
    if (!user) return user;
    if (user.affinity == null) {
      const { data, error } = await supabase
        .from('users')
        .update({ affinity: 0 })
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    return user;
  }

  async function fetchUserAffinity({ userId, twitchLogin } = {}) {
    if (!userId && !twitchLogin) return null;
    const baseQuery = supabase
      .from('users')
      .select('affinity, last_affinity_note');
    const { data, error } = userId
      ? await baseQuery.eq('id', userId).maybeSingle()
      : await baseQuery.ilike('twitch_login', twitchLogin).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function findOrCreateUser(tags) {
    const rawUsername = typeof tags.username === 'string' ? tags.username : '';
    const normalizedLogin = normalizeUsername(rawUsername);
    const displayName =
      (typeof tags['display-name'] === 'string' && tags['display-name'].trim()) ||
      (rawUsername && rawUsername.trim()) ||
      '';
    const username = displayName || normalizedLogin || `user_${Date.now()}`;
    const normalizedUsername = normalizeUsername(username);

    let user = null;

    if (normalizedLogin) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('twitch_login', normalizedLogin)
        .maybeSingle();
      if (error) throw error;
      user = data;
    }

    if (!user) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', normalizedUsername)
        .maybeSingle();
      if (error) throw error;
      user = data;
    }

    if (user) {
      if (normalizedLogin && user.twitch_login !== normalizedLogin) {
        const { data: updatedUser, error: updateErr } = await supabase
          .from('users')
          .update({ twitch_login: normalizedLogin })
          .eq('id', user.id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        user = updatedUser;
      }
      return ensureUserAffinity(user);
    }

    const res = await supabase
      .from('users')
      .insert({
        username,
        twitch_login: normalizedLogin || null,
        affinity: 0,
      })
      .select()
      .single();
    if (res.error) {
      if (res.error.code === '23505') {
        const fetchExisting = async () => {
          const { data: byLogin, error: loginErr } = normalizedLogin
            ? await supabase
                .from('users')
                .select('*')
                .ilike('twitch_login', normalizedLogin)
                .maybeSingle()
            : { data: null, error: null };
          if (loginErr) throw loginErr;
          if (byLogin) return byLogin;

          const { data: byUsername, error: usernameErr } = await supabase
            .from('users')
            .select('*')
            .ilike('username', normalizedUsername)
            .maybeSingle();
          if (usernameErr) throw usernameErr;
          return byUsername;
        };

        const existingUser = await fetchExisting();
        if (existingUser) {
          if (normalizedLogin && existingUser.twitch_login !== normalizedLogin) {
            const { data: updated, error: updateErr } = await supabase
              .from('users')
              .update({ twitch_login: normalizedLogin })
              .eq('id', existingUser.id)
              .select()
              .single();
            if (updateErr) throw updateErr;
            return ensureUserAffinity(updated);
          }
          return ensureUserAffinity(existingUser);
        }
      }
      throw res.error;
    }

    return ensureUserAffinity(res.data);
  }

  async function checkAndAwardAchievements(userId, field, value) {
    const thresholds = ACHIEVEMENT_THRESHOLDS[field] || [];
    let unlocked = false;
    for (const threshold of thresholds) {
      if (value < threshold) continue;
      const { data: achievement, error: achError } = await supabase
        .from('achievements')
        .select('id')
        .eq('stat_key', field)
        .eq('threshold', threshold)
        .maybeSingle();
      if (achError || !achievement) continue;
      const { data: existing, error: existError } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId)
        .eq('achievement_id', achievement.id)
        .maybeSingle();
      if (!existError && !existing) {
        const { error: insertError } = await supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_id: achievement.id,
            earned_at: new Date().toISOString(),
          });
        if (!insertError) {
          unlocked = true;
        }
      }
    }
    return unlocked;
  }

  async function incrementUserStat(userId, field, amount = 1) {
    let unlocked = false;
    try {
      const { data, error } = await supabase
        .from('users')
        .select(field)
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      const current = (data && data[field]) || 0;
      const newValue = current + amount;
      const { error: updateError } = await supabase
        .from('users')
        .update({ [field]: newValue })
        .eq('id', userId);
      if (updateError) throw updateError;

      unlocked = await checkAndAwardAchievements(userId, field, newValue);
    } catch (error) {
      console.error(`Failed to increment ${field} for user ${userId}`, error);
    }
    return unlocked;
  }

  async function updateSubMonths(username, tags = {}) {
    try {
      if (!twitchConfig?.channelId || !twitchConfig?.clientId) return;
      let userId = tags['user-id'];
      if (!userId) {
        try {
          const appToken = await getTwitchToken();
          const resp = await fetch(
            `https://api.twitch.tv/helix/users?login=${encodeURIComponent(
              username
            )}`,
            {
              headers: {
                'Client-ID': twitchConfig.clientId,
                Authorization: `Bearer ${appToken}`,
              },
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            userId = data.data?.[0]?.id;
          }
        } catch {
          return;
        }
      }
      if (!userId) return;
      const token = await getStreamerToken();
      if (!token) return;
      const url = new URL('https://api.twitch.tv/helix/subscriptions');
      url.searchParams.set('broadcaster_id', twitchConfig.channelId);
      url.searchParams.set('user_id', userId);
      const resp = await fetch(url.toString(), {
        headers: {
          'Client-ID': twitchConfig.clientId,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const months = data.data?.[0]?.cumulative_months;
      if (!months) return;
      const user = await findOrCreateUser({ ...tags, username });
      if ((user.total_months_subbed || 0) < months) {
        const { error } = await supabase
          .from('users')
          .update({ total_months_subbed: months })
          .eq('id', user.id);
        if (error) {
          console.error('Failed to update sub months', error);
        }
      }
    } catch (err) {
      console.error('updateSubMonths failed', err);
    }
  }

  return {
    findOrCreateUser,
    ensureUserAffinity,
    fetchUserAffinity,
    incrementUserStat,
    checkAndAwardAchievements,
    updateSubMonths,
  };
}

module.exports = {
  createUserService,
  ACHIEVEMENT_THRESHOLDS,
};
