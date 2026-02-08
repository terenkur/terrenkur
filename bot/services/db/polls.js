const DEFAULT_ACCEPT_VOTES_TTL_MS = 30 * 1000;

function createPollService({ supabase, ttlMs = DEFAULT_ACCEPT_VOTES_TTL_MS } = {}) {
  if (!supabase) {
    throw new Error('Poll service requires supabase client');
  }

  let cachedAcceptVotes = null;
  let acceptVotesFetchedAt = 0;

  function invalidateAcceptVotesCache() {
    cachedAcceptVotes = null;
    acceptVotesFetchedAt = 0;
  }

  async function getActivePoll() {
    const { data: poll, error } = await supabase
      .from('polls')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return poll;
  }

  async function getGamesForPoll(pollId) {
    const { data, error } = await supabase
      .from('poll_games')
      .select('game_id, games ( id, name )')
      .eq('poll_id', pollId);
    if (error) throw error;

    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('game_id')
      .eq('poll_id', pollId);
    if (votesError) throw votesError;

    const counts = (votes || []).reduce((acc, v) => {
      acc[v.game_id] = (acc[v.game_id] || 0) + 1;
      return acc;
    }, {});

    return data.map((pg) => ({
      ...pg.games,
      votes: counts[pg.game_id] || 0,
    }));
  }

  async function isVotingEnabled() {
    if (
      cachedAcceptVotes !== null &&
      Date.now() - acceptVotesFetchedAt < ttlMs
    ) {
      return cachedAcceptVotes;
    }

    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'accept_votes')
      .maybeSingle();
    if (error) {
      console.error('Failed to fetch accept_votes', error);
      return cachedAcceptVotes ?? true;
    }

    const enabled = !data || Number(data.value) !== 0;
    cachedAcceptVotes = enabled;
    acceptVotesFetchedAt = Date.now();
    return enabled;
  }

  async function addVote(user, pollId, gameId) {
    const { data: votes, error } = await supabase
      .from('votes')
      .select('slot')
      .eq('poll_id', pollId)
      .eq('user_id', user.id);
    if (error) {
      console.error('Failed to fetch votes', error);
      return { success: false, reason: 'db error' };
    }

    const limit = user.vote_limit || 1;
    if (votes.length >= limit) {
      return { success: false, reason: 'vote limit reached' };
    }

    const used = votes.map((v) => v.slot);
    let slot = null;
    for (let i = 1; i <= limit; i++) {
      if (!used.includes(i)) {
        slot = i;
        break;
      }
    }
    if (!slot) {
      return { success: false, reason: 'vote limit reached' };
    }

    const { error: insertError } = await supabase.from('votes').insert({
      poll_id: pollId,
      game_id: gameId,
      user_id: user.id,
      slot,
    });
    if (insertError) {
      console.error('Failed to insert vote', insertError);
      return { success: false, reason: 'db error' };
    }
    return { success: true };
  }

  return {
    getActivePoll,
    getGamesForPoll,
    addVote,
    isVotingEnabled,
    invalidateAcceptVotesCache,
  };
}

module.exports = {
  createPollService,
  DEFAULT_ACCEPT_VOTES_TTL_MS,
};
