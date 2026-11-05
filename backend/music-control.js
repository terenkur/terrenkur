const express = require('express');

const keys = {
  paused: 'music_player_paused', volume: 'music_player_volume', muted: 'music_player_muted',
  autoStart: 'music_queue_auto_start', lastSeen: 'music_player_seen', state: 'music_player_state',
  trackId: 'music_player_track', failure: 'music_player_failure',
};

function createMusicControl({ supabase, requireMusicPlayer, fetchQueue, broadcast }) {
  const router = express.Router();
  router.use(requireMusicPlayer);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const read = async () => {
    const { data, error } = await supabase.from('settings').select('key,value').in('key', Object.values(keys));
    if (error) throw error;
    const values = Object.fromEntries((data || []).map(row => [row.key, Number(row.value)]));
    return {
      paused: values[keys.paused] === 1, volume: values[keys.volume] ?? 100,
      muted: values[keys.muted] === 1, autoStart: (values[keys.autoStart] ?? 1) !== 0,
      lastSeen: values[keys.lastSeen] || 0, state: values[keys.state] ?? -1,
      trackId: values[keys.trackId] || null,
      failure: values[keys.failure] || 0,
      online: Date.now() - (values[keys.lastSeen] || 0) < 15000,
    };
  };
  const write = async values => {
    const rows = Object.entries(values).map(([name, value]) => ({ key: keys[name], value: Number(value) }));
    const { error } = await supabase.from('settings').upsert(rows);
    if (error) throw error;
  };
  const route = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (error) { console.error('Music control failed', error); res.status(500).json({ error: 'Не удалось выполнить запрос. Повторите попытку.' }); }
  };
  router.get('/playback', route(async (_req, res) => res.json(await read())));
  router.get('/', route(async (_req, res) => {
    const [queue, playback] = await Promise.all([fetchQueue(), read()]);
    res.json({ ...queue, playback });
  }));
  router.post('/settings', route(async (req, res) => {
    const input = req.body;
    const names = Object.keys(input || {});
    if (!names.length || names.some(name => !['paused', 'volume', 'muted', 'autoStart'].includes(name)) ||
      names.some(name => name === 'volume'
        ? !Number.isInteger(input[name]) || input[name] < 0 || input[name] > 100
        : typeof input[name] !== 'boolean')) {
      return res.status(400).json({ error: 'Некорректная команда' });
    }
    await write(input);
    await broadcast(typeof input.autoStart === 'boolean' ? { autoStart: input.autoStart } : { type: 'CONTROL' });
    res.json({ ok: true });
  }));
  router.post('/heartbeat', route(async (req, res) => {
    const { state, trackId, failure = 0 } = req.body || {};
    if (![-1, 0, 1, 2, 3, 5].includes(state) ||
        !Number.isInteger(failure) || failure < 0 || failure > 1002 ||
        (trackId !== null && (!Number.isSafeInteger(trackId) || trackId < 1))) {
      return res.status(400).json({ error: 'Invalid playback report' });
    }
    await write({ state, trackId: trackId || 0, failure, lastSeen: Date.now() });
    res.json({ ok: true });
  }));
  router.post('/:id/replay', route(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
    const { data: item, error } = await supabase.from('music_queue').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!item) return res.status(404).json({ error: 'Песня не найдена' });
    if (!['completed', 'skipped'].includes(item.status)) return res.status(409).json({ error: 'Песня ещё не в истории' });
    // A fresh request preserves history and never interrupts the current track.
    const { data: added, error: insertError } = await supabase.from('music_queue').insert({
      url: item.url, title: item.title, preview_url: item.preview_url,
      requested_by: item.requested_by, status: 'pending',
    }).select().single();
    if (insertError) throw insertError;
    await broadcast({ type: 'INSERT', new: added });
    res.json({ item: added });
  }));
  return router;
}

module.exports = { createMusicControl };
