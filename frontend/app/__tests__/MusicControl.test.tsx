import { act, fireEvent, render, screen } from "@testing-library/react";
process.env.NEXT_PUBLIC_BACKEND_URL = "https://queue.test";
const Page = require("../(player)/player/control/page").default;
let snapshot: any;
let fetchMock: jest.Mock;
beforeEach(() => {
  jest.useFakeTimers();
  window.history.replaceState(null, "", `/player/control#token=${"ab".repeat(32)}`);
  snapshot = { active: { id: 1, title: 'Current song' }, queue: [], history: [{ id: 3, title: 'Old song' }],
    playback: { paused: false, muted: false, volume: 70, autoStart: true, online: true, state: 1, trackId: 1 } };
  fetchMock = jest.fn(async (_url, options) => {
    if (options.method === 'POST' && _url.endsWith('/settings')) Object.assign(snapshot.playback, JSON.parse(options.body));
    return { ok: true, json: async () => JSON.parse(JSON.stringify(snapshot)) };
  });
  global.fetch = fetchMock;
});
afterEach(() => { jest.useRealTimers(); });
const flush = () => act(async () => {});
it('sends pause and resume commands to the remote player using the URL token', async () => {
  render(<Page />); await flush();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Пауза' })));
  expect(snapshot.playback.paused).toBe(true);
  expect(fetchMock).toHaveBeenCalledWith('https://queue.test/api/music-queue/control/settings', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ paused: true }), headers: expect.objectContaining({ 'X-Music-Player-Token': 'ab'.repeat(32) }),
  }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Продолжить' })));
  expect(snapshot.playback.paused).toBe(false);
});
it('shows history and enqueues a selected song', async () => {
  render(<Page />); await flush();
  fireEvent.click(screen.getByRole('button', { name: 'История' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Повторить Old song' })));
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/control/3/replay'), expect.objectContaining({ method: 'POST' }));
  expect(screen.getByText('Песня добавлена в конец очереди')).toBeInTheDocument();
});
it('shows invalid token errors instead of implying the player is connected', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 401 });
  render(<Page />); await flush();
  expect(screen.getByRole('alert')).toHaveTextContent('Проверьте токен');
  expect(screen.getByRole('button', { name: 'Пауза' })).toBeDisabled();
});
