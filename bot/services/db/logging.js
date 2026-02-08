function createLoggingService({ supabase, obsClient, twitchConfig, getStreamerToken } = {}) {
  if (!supabase) {
    throw new Error('Logging service requires supabase client');
  }

  async function logEvent(
    message,
    mediaUrl = null,
    previewUrl = null,
    title = null,
    type = null
  ) {
    try {
      await supabase.from('event_logs').insert({
        message,
        media_url: mediaUrl,
        preview_url: previewUrl,
        title,
        type,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to log event', err);
    }

    const shouldTriggerObs =
      Boolean(type) && /^(intim|poceluy)_/.test(type) && obsClient?.isConfigured();
    if (shouldTriggerObs) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('obs_media')
            .select('gif_url, sound_url')
            .eq('type', type);
          if (error) {
            throw error;
          }
          if (!Array.isArray(data) || data.length === 0) {
            return;
          }
          const selected = data[Math.floor(Math.random() * data.length)];
          if (!selected) return;
          await obsClient.updateMediaInputs({
            gifUrl: selected.gif_url || null,
            soundUrl: selected.sound_url || null,
          });
        } catch (err) {
          console.error(`Failed to process OBS media for type ${type}`, err);
        }
      })();
    }
  }

  async function fetchRewardName(rewardId) {
    if (!twitchConfig?.channelId || !twitchConfig?.clientId) return null;
    try {
      const token = await getStreamerToken();
      if (!token) return null;
      const url = new URL(
        'https://api.twitch.tv/helix/channel_points/custom_rewards'
      );
      url.searchParams.set('broadcaster_id', twitchConfig.channelId);
      url.searchParams.set('id', rewardId);
      const resp = await fetch(url.toString(), {
        headers: {
          'Client-ID': twitchConfig.clientId,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const reward = Array.isArray(data.data) ? data.data[0] : null;
      return reward?.title || null;
    } catch (err) {
      console.error('Failed to fetch reward name', err);
      return null;
    }
  }

  async function loadRewardIds() {
    try {
      const { data, error } = await supabase
        .from('log_rewards')
        .select('reward_id');
      if (error) throw error;
      return (data || []).map((r) => r.reward_id).filter(Boolean);
    } catch (err) {
      console.error('Failed to load reward IDs', err);
      return [];
    }
  }

  return {
    logEvent,
    fetchRewardName,
    loadRewardIds,
  };
}

module.exports = {
  createLoggingService,
};
