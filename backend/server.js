const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get('/api/data', async (req, res) => {
  const { data, error } = await supabase.from('items').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get the most recent poll with aggregated vote counts
app.get('/api/poll', async (_req, res) => {
  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pollError) return res.status(500).json({ error: pollError.message });
  if (!poll) return res.status(404).json({ error: 'No poll found' });

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, name');
  if (gamesError) return res.status(500).json({ error: gamesError.message });

  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('game_id, user_id')
    .eq('poll_id', poll.id);
  if (votesError) return res.status(500).json({ error: votesError.message });

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, username');
  if (usersError) return res.status(500).json({ error: usersError.message });

  const userMap = users.reduce((acc, u) => {
    acc[u.id] = u.username;
    return acc;
  }, {});

  const counts = votes.reduce((acc, v) => {
    acc[v.game_id] = (acc[v.game_id] || 0) + 1;
    return acc;
  }, {});

  const nicknames = votes.reduce((acc, v) => {
    if (!acc[v.game_id]) acc[v.game_id] = [];
    const name = userMap[v.user_id];
    if (name) acc[v.game_id].push(name);
    return acc;
  }, {});

  const results = games.map((g) => ({
    id: g.id,
    name: g.name,
    count: counts[g.id] || 0,
    nicknames: nicknames[g.id] || [],
  }));

  res.json({ poll_id: poll.id, created_at: poll.created_at, games: results });
});

// Record a vote for a specific game in a poll
app.post('/api/vote', async (req, res) => {
  let { poll_id, game_id, slot, username } = req.body;
  if (!poll_id) {
    return res.status(400).json({ error: 'poll_id is required' });
  }

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  let { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authUser.id)
    .maybeSingle();
  if (userError) return res.status(500).json({ error: userError.message });

  if (!user) {
    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({ auth_id: authUser.id, username })
      .select()
      .single();
    if (insertError) return res.status(500).json({ error: insertError.message });
    user = newUser;
  } else if (username && user.username !== username) {
    // Update username if it changed
    await supabase.from('users').update({ username }).eq('id', user.id);
  }

  const { data: existingVotes, error: votesError } = await supabase
    .from('votes')
    .select('id, slot')
    .eq('poll_id', poll_id)
    .eq('user_id', user.id);
  if (votesError) {
    return res.status(500).json({ error: votesError.message });
  }

  const limit = user.vote_limit || 1;

  const current = existingVotes || [];
  const existing = current.find((v) => v.slot === slot);

  if (game_id === null) {
    if (existing) {
      const { error: delError } = await supabase
        .from('votes')
        .delete()
        .eq('id', existing.id);
      if (delError) {
        return res.status(500).json({ error: delError.message });
      }
      return res.status(200).json({ success: true, deleted: true });
    }
    return res.status(404).json({ error: 'Vote not found for slot' });
  }

  if (!slot) {
    const used = current.map((v) => v.slot);
    for (let i = 1; i <= limit; i++) {
      if (!used.includes(i)) {
        slot = i;
        break;
      }
    }
    if (!slot) {
      return res.status(400).json({ error: 'Vote limit reached' });
    }
  } else if (slot > limit) {
    return res.status(400).json({ error: 'slot exceeds vote_limit' });
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('votes')
      .update({ game_id })
      .eq('id', existing.id);
    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }
    return res.status(200).json({ success: true, updated: true });
  }

  if (current.length >= limit) {
    return res.status(400).json({ error: 'Vote limit reached' });
  }

  const { error: voteError } = await supabase.from('votes').insert({
    poll_id,
    game_id,
    user_id: user.id,
    slot,
  });

  if (voteError) {
    return res.status(500).json({ error: voteError.message });
  }
  res.status(201).json({ success: true });
});

// Update vote limit for a user (simple admin token check)
app.post('/api/set_vote_limit', async (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { user_id, vote_limit } = req.body;
  if (!user_id || typeof vote_limit !== 'number') {
    return res.status(400).json({ error: 'user_id and vote_limit are required' });
  }
  const { error } = await supabase
    .from('users')
    .update({ vote_limit })
    .eq('id', user_id);
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true });
});

// Get current wheel coefficient
app.get('/api/voice_coeff', async (_req, res) => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'wheel_coeff')
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  const coeff = data ? Number(data.value) : 2;
  res.json({ coeff });
});

// Update wheel coefficient (moderators only)
app.post('/api/voice_coeff', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('is_moderator')
    .eq('auth_id', authUser.id)
    .maybeSingle();
  if (userError) return res.status(500).json({ error: userError.message });
  if (!user || !user.is_moderator) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { coeff } = req.body;
  if (typeof coeff !== 'number') {
    return res.status(400).json({ error: 'coeff must be a number' });
  }

  const { error: upError } = await supabase
    .from('settings')
    .upsert({ key: 'wheel_coeff', value: coeff });
  if (upError) return res.status(500).json({ error: upError.message });

  res.json({ success: true });
});

// Get current zero vote weight
app.get('/api/zero_vote_weight', async (_req, res) => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'zero_vote_weight')
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  const weight = data ? Number(data.value) : 40;
  res.json({ weight });
});

// Update zero vote weight (moderators only)
app.post('/api/zero_vote_weight', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('is_moderator')
    .eq('auth_id', authUser.id)
    .maybeSingle();
  if (userError) return res.status(500).json({ error: userError.message });
  if (!user || !user.is_moderator) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { weight } = req.body;
  if (typeof weight !== 'number') {
    return res.status(400).json({ error: 'weight must be a number' });
  }

  const { error: upError } = await supabase
    .from('settings')
    .upsert({ key: 'zero_vote_weight', value: weight });
  if (upError) return res.status(500).json({ error: upError.message });

  res.json({ success: true });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
