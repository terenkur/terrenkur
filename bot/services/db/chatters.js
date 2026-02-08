function normalizeUsername(value) {
  if (!value) return '';
  return value.toString().trim().replace(/^@/, '').toLowerCase();
}

function createChatterService({ supabase } = {}) {
  if (!supabase) {
    throw new Error('Chatter service requires supabase client');
  }

  async function fetchRandomChatterUsername() {
    try {
      const { data, error } = await supabase
        .from('stream_chatters')
        .select('users ( username, twitch_login )');
      if (error) throw error;

      const names = (data || [])
        .map((entry) => {
          const user = entry?.users || {};
          const username =
            typeof user.username === 'string' ? user.username.trim() : '';
          const login =
            typeof user.twitch_login === 'string'
              ? user.twitch_login.trim()
              : '';
          return username || login || null;
        })
        .filter(Boolean);

      if (!names.length) {
        return null;
      }

      const idx = Math.floor(Math.random() * names.length);
      return names[idx];
    } catch (err) {
      console.error('Failed to fetch random chatter', err);
      return null;
    }
  }

  async function fetchWhereMentionCandidates(subjectText, limit = 3) {
    const exclude = new Set();
    const normalizedSubject = normalizeUsername(subjectText);
    if (normalizedSubject) {
      exclude.add(normalizedSubject);
    }

    try {
      const { data, error } = await supabase
        .from('stream_chatters')
        .select('users ( username )');
      if (error) throw error;

      const rawNames = (data || [])
        .map((entry) => entry?.users?.username)
        .filter(Boolean)
        .map((name) => name.toString().trim())
        .filter((name) => name);

      const uniqueNames = [];
      for (const name of rawNames) {
        const normalized = normalizeUsername(name);
        if (!normalized || exclude.has(normalized)) continue;
        if (uniqueNames.find((n) => normalizeUsername(n) === normalized)) continue;
        uniqueNames.push(name);
      }

      if (!uniqueNames.length) {
        return [];
      }

      const sample = [];
      const pool = [...uniqueNames];
      while (pool.length && sample.length < limit) {
        const idx = Math.floor(Math.random() * pool.length);
        const [name] = pool.splice(idx, 1);
        sample.push(name);
      }

      return sample;
    } catch (err) {
      console.error('Failed to fetch where chatter mentions', err);
      return [];
    }
  }

  async function fetchIntimMentionCandidates({
    chatters = null,
    exclude = new Set(),
    limit = 5,
  } = {}) {
    let source = Array.isArray(chatters) ? chatters : null;

    if (!source || !source.length) {
      try {
        const { data, error } = await supabase
          .from('stream_chatters')
          .select('users ( username )');
        if (error) throw error;
        source = data || [];
      } catch (err) {
        console.error('Failed to fetch intim chatter mentions', err);
        return [];
      }
    }

    const rawNames = (source || [])
      .map((entry) => entry?.users?.username)
      .filter(Boolean)
      .map((name) => name.toString().trim())
      .filter((name) => name);

    if (!rawNames.length) {
      return [];
    }

    const unique = [];
    for (const name of rawNames) {
      const normalized = normalizeUsername(name);
      if (!normalized || exclude.has(normalized)) continue;
      if (unique.find((existing) => normalizeUsername(existing) === normalized)) {
        continue;
      }
      unique.push(name);
      if (unique.length >= limit) {
        break;
      }
    }

    return unique;
  }

  return {
    fetchRandomChatterUsername,
    fetchWhereMentionCandidates,
    fetchIntimMentionCandidates,
  };
}

module.exports = {
  createChatterService,
};
