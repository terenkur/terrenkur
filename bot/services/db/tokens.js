function createTokenService({ supabase, twitchConfig } = {}) {
  if (!supabase) {
    throw new Error('Token service requires supabase client');
  }

  let twitchToken = null;
  let twitchExpiry = 0;

  async function getTwitchToken() {
    if (twitchToken && twitchExpiry - 60 > Math.floor(Date.now() / 1000)) {
      return twitchToken;
    }
    if (!twitchConfig?.clientId || !twitchConfig?.secret) {
      throw new Error('Twitch credentials not configured');
    }
    const url = `https://id.twitch.tv/oauth2/token?client_id=${twitchConfig.clientId}&client_secret=${twitchConfig.secret}&grant_type=client_credentials`;
    const resp = await fetch(url, { method: 'POST' });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Auth failed: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    twitchToken = data.access_token;
    twitchExpiry = Math.floor(Date.now() / 1000) + (data.expires_in || 0);
    return twitchToken;
  }

  let donationToken = null;
  let donationExpiry = 0;
  let donationTokenMissingWarned = false;
  let donationTokenErrorWarned = false;

  async function getDonationAlertsToken() {
    if (donationToken && donationExpiry - 60 > Math.floor(Date.now() / 1000)) {
      return donationToken;
    }
    try {
      const { data, error } = await supabase
        .from('donationalerts_tokens')
        .select('access_token, expires_at')
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data || !data.access_token) {
        donationToken = null;
        donationExpiry = 0;
        if (!donationTokenMissingWarned) {
          console.warn('Donation Alerts token not found');
          donationTokenMissingWarned = true;
        }
        return null;
      }

      donationToken = data.access_token;
      donationExpiry = data.expires_at
        ? Math.floor(new Date(data.expires_at).getTime() / 1000)
        : 0;
      donationTokenMissingWarned = false;
      donationTokenErrorWarned = false;
      return donationToken;
    } catch (err) {
      donationToken = null;
      donationExpiry = 0;
      if (!donationTokenErrorWarned) {
        console.warn('Failed to load Donation Alerts token', err);
        donationTokenErrorWarned = true;
      }
      return null;
    }
  }

  let streamerToken = null;
  let streamerExpiry = 0;

  async function getStreamerToken() {
    const now = Math.floor(Date.now() / 1000);
    if (streamerToken && streamerExpiry - 60 > now) {
      return streamerToken;
    }
    try {
      const { data, error } = await supabase
        .from('twitch_tokens')
        .select('access_token, expires_at')
        .maybeSingle();
      if (!error && data && data.access_token) {
        streamerToken = data.access_token;
        streamerExpiry = data.expires_at
          ? Math.floor(new Date(data.expires_at).getTime() / 1000)
          : 0;
        if (streamerExpiry === 0 || streamerExpiry - 60 > now) {
          return streamerToken;
        }
      }
    } catch (err) {
      console.error('Failed to load streamer token', err);
    }
    return null;
  }

  return {
    getTwitchToken,
    getDonationAlertsToken,
    getStreamerToken,
  };
}

module.exports = {
  createTokenService,
};
