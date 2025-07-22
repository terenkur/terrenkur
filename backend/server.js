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
    .select('game_id')
    .eq('poll_id', poll.id);
  if (votesError) return res.status(500).json({ error: votesError.message });

  const counts = votes.reduce((acc, v) => {
    acc[v.game_id] = (acc[v.game_id] || 0) + 1;
    return acc;
  }, {});

  const results = games.map((g) => ({
    id: g.id,
    name: g.name,
    count: counts[g.id] || 0,
  }));

  res.json({ poll_id: poll.id, created_at: poll.created_at, games: results });
});

// Record a vote for a specific game in a poll
app.post('/api/vote', async (req, res) => {
  const { poll_id, game_id, username } = req.body;
  if (!poll_id || !game_id) {
    return res.status(400).json({ error: 'poll_id and game_id are required' });
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

  const { data: existing } = await supabase
    .from('votes')
    .select('id')
    .eq('poll_id', poll_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) {
    return res.status(400).json({ error: 'User has already voted' });
  }

  const { error: voteError } = await supabase.from('votes').insert({
    poll_id,
    game_id,
    user_id: user.id,
  });

  if (voteError) {
    if (voteError.code === '23505') {
      return res.status(400).json({ error: 'User has already voted' });
    }
    return res.status(500).json({ error: voteError.message });
  }
  res.status(201).json({ success: true });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
