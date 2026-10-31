import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({ useRouter: () => ({}) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/RouletteWheel', () => () => null);
jest.mock('@/lib/supabase', () => ({ supabase: {
  auth: {
    getSession: async () => ({ data: { session: { access_token: 'test' } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
  },
  channel: () => ({ on: jest.fn(), subscribe: jest.fn() }),
  removeChannel: jest.fn(),
} }));
jest.mock('@/lib/profile', () => ({ fetchMyProfile: jest.fn() }));
jest.mock('@/lib/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }));

process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend';
const Home = require('../(main)/page').default;
const { fetchWithTimeout } = require('@/lib/fetchWithTimeout');
const { fetchMyProfile } = require('@/lib/profile');
const json = (body: unknown) => ({ ok: true, json: async () => body });

it('keeps votes visible through a settings failure and waits for permissions after retry', async () => {
  let failSetting!: (reason: Error) => void;
  let approveProfile!: (value: unknown) => void;
  const pendingSetting = new Promise((_, reject) => { failSetting = reject; });
  fetchMyProfile.mockReturnValue(new Promise(resolve => { approveProfile = resolve; }));
  let retry = false;
  fetchWithTimeout.mockImplementation(async (url: string) => {
    if (url.endsWith('/poll')) return json({ poll_id: 1, games: [
      { id: 7, name: 'DOOM', count: 3, nicknames: [{ id: 2, username: 'viewer', count: 3 }] },
    ] });
    if (url.endsWith('/allow_edit') && !retry) return pendingSetting;
    return json({ value: 1, coeff: 2, weight: 40, duration: 4 });
  });
  render(<Home />);
  expect(await screen.findByRole('link', { name: 'DOOM' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'viewer' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'spin' })).toBeDisabled();
  await act(async () => failSetting(new Error('offline')));
  expect(screen.getByRole('alert')).toHaveTextContent('pollSettingsFailed');
  expect(screen.getByRole('link', { name: 'DOOM' })).toBeVisible();
  retry = true;
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'retry' })); });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('button', { name: 'settingsModal.title' })).toBeNull();
  await act(async () => approveProfile({ data: { is_moderator: true } }));
  expect(screen.getByRole('button', { name: 'settingsModal.title' })).toBeEnabled();
  expect(fetchWithTimeout.mock.calls.filter(([url]: [string]) => url.endsWith('/poll'))).toHaveLength(1);
});
