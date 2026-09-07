import { renderHook, waitFor } from '@testing-library/react';
import { useTwitchUserInfo } from '../useTwitchUserInfo';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(() => {
  process.env.NEXT_PUBLIC_ENABLE_TWITCH_ROLES = 'true';
  process.env.NEXT_PUBLIC_BACKEND_URL = 'https://backend';
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ roles: { bob: { roles: ['VIP'], profileImageUrl: 'https://static-cdn.jtvnw.net/bob.png' } } }) });
});
it('loads public avatar and roles without browser credentials', async () => {
  const { result } = renderHook(() => useTwitchUserInfo('Bob'));
  await waitFor(() => expect(result.current.roles).toEqual(['VIP']));
  expect(result.current.profileUrl).toBe('https://static-cdn.jtvnw.net/bob.png');
  expect(global.fetch).toHaveBeenCalledWith('https://backend/api/twitch-roles?login=bob', expect.objectContaining({ signal: expect.anything() }));
  expect((global.fetch as jest.Mock).mock.calls[0][1].headers).toBeUndefined();
});
it('reports errors without fetching or rotating streamer credentials', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 });
  const { result } = renderHook(() => useTwitchUserInfo('bob'));
  await waitFor(() => expect(result.current.error).toBe('twitchInfoFetchFailed'));
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
it('does not query with an empty login', () => {
  renderHook(() => useTwitchUserInfo(null));
  expect(global.fetch).not.toHaveBeenCalled();
});
it('cancels pending requests on unmount', () => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  const { unmount } = renderHook(() => useTwitchUserInfo('bob'));
  const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal;
  unmount(); expect(signal.aborted).toBe(true);
});
