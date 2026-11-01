import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({ useRouter: () => ({}) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/RouletteWheel', () => (props: any) =>
  <button onClick={() => props.onDone(props.games[0])}>finish animation</button>);
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

it('keeps the stopped game in place until the next round, then records its original risk', async () => {
  const games = ['A', 'B', 'C'].map((name, id) => ({ name, id, count: 1, nicknames: [] }));
  fetchMyProfile.mockResolvedValue({ data: null });
  fetchWithTimeout.mockImplementation(async (url: string) => url.endsWith('/poll')
    ? json({ poll_id: 1, games })
    : json({ value: 0, coeff: 2, weight: 40, duration: 4 }));
  render(<Home />);
  await screen.findByRole('link', { name: 'A' });
  const spin = screen.getByRole('button', { name: 'wheelControls.trial' });
  fireEvent.click(spin);
  expect(spin).toBeDisabled();
  fireEvent.click(screen.getByText('finish animation'));
  expect(screen.getByText(/Выбыла в раунде 1/)).toHaveTextContent('33,3%');
  expect(screen.queryByRole('heading', { name: 'Выбыли' })).toBeNull();
  fireEvent.click(screen.getByText('Следующий раунд'));
  const firstOut = screen.getByRole('link', { name: 'A' }).closest('li');
  expect(firstOut).toHaveTextContent('Выбыла в раунде 1');
  expect(firstOut).toHaveTextContent('pollCard.pastWinChance33,3%');
  expect(firstOut).toHaveTextContent('pollCard.pastRisk33,3%');
  expect(screen.getByRole('link', { name: 'B' }).closest('li')).toHaveTextContent('50,0%');
  expect(screen.getByRole('link', { name: 'B' }).closest('li')).toHaveTextContent('было 33,3%');
  fireEvent.click(screen.getByRole('button', { name: 'wheelControls.trial' }));
  fireEvent.click(screen.getByText('finish animation'));
  fireEvent.click(screen.getByText('Завершить рулетку'));
  expect(screen.getByText('Раунд 2', { selector: 'span' }).closest('li')).toHaveTextContent('50%');
  fireEvent.change(screen.getByLabelText('Игра'), { target: { value: '0' } });
  expect(screen.getByText('Раунд 1 · выбыла').closest('li')).toHaveTextContent('33,3%');
  expect(screen.queryByText('Раунд 2', { selector: 'span' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Раунд', { exact: false, selector: 'select' }), { target: { value: '0' } });
  expect(screen.getByText('A · выбыла').closest('li')).toHaveTextContent('33,3%');
  expect(screen.getByRole('heading', { name: 'Победитель' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'B' }).closest('li')).toHaveTextContent('pollCard.pastRisk50,0%');
  expect(firstOut).toHaveTextContent('pollCard.pastWinChance33,3%');
});

it('keeps votes visible through a settings failure and waits for permissions after retry', async () => {
  fetchWithTimeout.mockClear();
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
  fireEvent.click(screen.getByText('pollCard.voters'));
  expect(screen.getByRole('link', { name: 'viewer' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'wheelControls.trial' })).toBeDisabled();
  await act(async () => failSetting(new Error('offline')));
  expect(screen.getByRole('alert')).toHaveTextContent('pollSettingsFailed');
  expect(screen.getByRole('link', { name: 'DOOM' })).toBeVisible();
  retry = true;
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'retry' })); });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('button', { name: /wheelControls.menu/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'wheelControls.official' })).toBeDisabled();
  await act(async () => approveProfile({ data: { is_moderator: true } }));
  expect(screen.getByRole('button', { name: 'wheelControls.official' })).toBeEnabled();
  fireEvent.keyDown(screen.getByRole('button', { name: /wheelControls.menu/ }), { key: 'Enter' });
  expect(await screen.findByRole('menuitem', { name: 'settingsModal.title' })).toBeVisible();
  expect(fetchWithTimeout.mock.calls.filter(([url]: [string]) => url.endsWith('/poll'))).toHaveLength(1);
});
