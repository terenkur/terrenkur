function getYoutubeThumbnail(url) {
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.includes('youtu.be')) {
      id = u.pathname.split('/')[1];
    } else if (u.hostname.includes('youtube.com')) {
      id = u.searchParams.get('v');
    }
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

function createBackgroundTasks({
  supabase,
  loggingService,
  tokenService,
  userService,
  twitchConfig,
  streamState,
  getRewardIds,
  setRewardIds,
} = {}) {
  if (!supabase) {
    throw new Error('Background tasks require supabase client');
  }

  async function checkNewFollower() {
    if (!twitchConfig?.channelId || !twitchConfig?.clientId || !twitchConfig?.secret) return;
    try {
      const token = await tokenService.getTwitchToken();
      const url = new URL('https://api.twitch.tv/helix/users/follows');
      url.searchParams.set('to_id', twitchConfig.channelId);
      url.searchParams.set('first', '1');
      const resp = await fetch(url.toString(), {
        headers: { 'Client-ID': twitchConfig.clientId, Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const follow = data.data && data.data[0];
      if (follow && follow.from_id !== checkNewFollower.lastId) {
        checkNewFollower.lastId = follow.from_id;
        await loggingService.logEvent(`New follow: ${follow.from_name}`);
      }
    } catch (err) {
      console.error('Follower check failed', err);
    }
  }

  async function loadRewardIds() {
    const rewardIds = await loggingService.loadRewardIds();
    if (rewardIds.length > 0 || getRewardIds().length > 0) {
      const merged = Array.from(new Set([...getRewardIds(), ...rewardIds]));
      setRewardIds(merged);
    }
  }

  let lastDonationId = 0;

  async function loadLastDonationId() {
    try {
      let query = supabase.from && supabase.from('event_logs');
      if (!query || typeof query.select !== 'function') {
        return;
      }
      query = query.select('title');
      if (!query || typeof query.eq !== 'function') {
        return;
      }
      query = query.eq('type', 'donation');
      if (!query || typeof query.order !== 'function') {
        return;
      }
      query = query.order('created_at', { ascending: false });
      if (!query || typeof query.limit !== 'function') {
        return;
      }
      query = query.limit(1);
      if (!query || typeof query.maybeSingle !== 'function') {
        return;
      }
      const { data, error } = await query.maybeSingle();
      if (!error && data && data.title) {
        const parsed = parseInt(data.title, 10);
        if (!Number.isNaN(parsed)) {
          lastDonationId = parsed;
        }
      }
    } catch (err) {
      console.error('Failed to load last donation id', err);
    }
  }

  async function checkDonations() {
    try {
      const token = await tokenService.getDonationAlertsToken();
      if (!token) return;
      const resp = await fetch(
        'https://www.donationalerts.com/api/v1/alerts/donations',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) return;
      const data = await resp.json();
      const donations = Array.isArray(data?.data) ? data.data : [];

      // Ensure deterministic order and correct cursor handling
      donations.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

      let processedMaxId = lastDonationId;
      for (const d of donations) {
        if (!d || typeof d.id !== 'number') continue;
        if (d.id <= lastDonationId) continue;
        processedMaxId = Math.max(processedMaxId, d.id);
        const name = d.username || d.name || 'Anonymous';
        const amount = `${d.amount}${d.currency ? ' ' + d.currency : ''}`;
        const msg = `Donation from ${name}: ${amount}`;
        const mediaUrl = d.media?.url || null;
        let previewUrl = null;
        if (mediaUrl && (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be'))) {
          previewUrl = getYoutubeThumbnail(mediaUrl);
        }
        await loggingService.logEvent(msg, mediaUrl, previewUrl, String(d.id), 'donation');
      }
      lastDonationId = processedMaxId;
    } catch (err) {
      console.error('Donation check failed', err);
    }
  }

  async function checkStreamStatus() {
    if (!twitchConfig?.channelId || !twitchConfig?.clientId) return;
    try {
      let token = null;
      if (twitchConfig.secret) {
        try {
          token = await tokenService.getTwitchToken();
        } catch (err) {
          console.error('App token fetch failed, trying streamer token', err);
        }
      }
      if (!token) {
        token = await tokenService.getStreamerToken();
      }
      if (!token) return;
      const url = new URL('https://api.twitch.tv/helix/streams');
      url.searchParams.set('user_id', twitchConfig.channelId);
      const resp = await fetch(url.toString(), {
        headers: {
          'Client-ID': twitchConfig.clientId,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const online = Array.isArray(data.data) && data.data.length > 0;
      const streamData = online ? data.data[0] : null;
      streamState.currentStreamGame = streamData?.game_name || null;
      streamState.streamStartedAt = streamData?.started_at || null;
      const wasOnline = streamState.streamOnline;
      streamState.streamOnline = online;
      if (wasOnline === null) {
        if (!online) {
          streamState.currentStreamGame = null;
          streamState.streamStartedAt = null;
          return;
        }
        try {
          const { data: chatters, error } = await supabase
            .from('stream_chatters')
            .select('user_id');
          if (error) throw error;
          if (!Array.isArray(chatters) || chatters.length === 0) {
            streamState.joinedThisStream.clear();
            streamState.firstMessageAchieved = false;
            streamState.firstMessageUserId = null;
            await supabase.from('stream_chatters').delete().neq('user_id', 0);
          }
        } catch (err) {
          console.error('Stream chatter preservation check failed', err);
        }
        return;
      }
      if (wasOnline === true && !online) {
        streamState.joinedThisStream.clear();
        streamState.firstMessageAchieved = false;
        streamState.firstMessageUserId = null;
        streamState.currentStreamGame = null;
        streamState.streamStartedAt = null;
        await supabase.from('stream_chatters').delete().neq('user_id', 0);
      } else if (wasOnline === false && online) {
        streamState.joinedThisStream.clear();
        streamState.firstMessageAchieved = false;
        streamState.firstMessageUserId = null;
        streamState.currentStreamGame = streamData?.game_name || null;
        streamState.streamStartedAt = streamData?.started_at || null;
        await supabase.from('stream_chatters').delete().neq('user_id', 0);
      }
    } catch (err) {
      console.error('Stream status check failed', err);
    }
  }

  async function incrementWatchTime() {
    try {
      const { data, error } = await supabase
        .from('stream_chatters')
        .select('user_id');
      if (error) throw error;
      const chatters = data || [];
      await Promise.all(
        chatters.map((c) => userService.incrementUserStat(c.user_id, 'total_watch_time'))
      );
    } catch (err) {
      console.error('watch time update failed', err);
    }
  }

  function start() {
    if (twitchConfig?.channelId && twitchConfig?.clientId && twitchConfig?.secret) {
      setInterval(checkNewFollower, 60000);
    }

    loadRewardIds();
    setInterval(loadRewardIds, 60000);

    loadLastDonationId().finally(() => {
      checkDonations();
      setInterval(checkDonations, 10000);
    });

    checkStreamStatus();
    setInterval(checkStreamStatus, 60000);

    setInterval(incrementWatchTime, 60 * 1000);
  }

  return {
    start,
    checkDonations,
  };
}

module.exports = {
  createBackgroundTasks,
};
