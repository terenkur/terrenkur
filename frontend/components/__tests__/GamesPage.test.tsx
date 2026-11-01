import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../i18n';
import i18n from '../../i18n';

process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend';

const GamesPage = require('@/app/(main)/games/page').default;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));

const { supabase: mockSupabase } = require('@/lib/supabase');

describe('GamesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('only fetches on explicit search with filters', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    const fetchMock = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ games: [], availableGenres: [] }),
      });
    (global as any).fetch = fetchMock;

    render(<GamesPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const searchInput = await screen.findByPlaceholderText(i18n.t('searchPlaceholder'));
    fireEvent.change(searchInput, { target: { value: 'foo' } });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText(i18n.t('search')));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith('http://backend/api/games?search=foo');
  });
  it('keeps results and filters during a search and retries the failed query', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    const game = { id: 1, name: 'Portal', status: 'completed', rating: 9, genres: [], initiators: [] };
    const success = { ok: true, json: async () => ({ games: [game] }) };
    let finish!: (value: { ok: boolean }) => void;
    const pending = new Promise(resolve => { finish = resolve; });
    const fetchMock = jest.fn().mockResolvedValueOnce(success)
      .mockReturnValueOnce(pending).mockResolvedValueOnce(success);
    global.fetch = fetchMock;
    render(<GamesPage />);
    const link = await screen.findByRole('link', { name: game.name });
    const field = screen.getByPlaceholderText(i18n.t('searchPlaceholder'));
    fireEvent.change(field, { target: { value: 'Portal' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByRole('link', { name: game.name })).toBe(link);
    expect(screen.getByRole('status').textContent).toContain('Обновляем');
    finish({ ok: false });
    await screen.findByRole('alert');
    expect((field as HTMLInputElement).value).toBe('Portal');
    fireEvent.click(screen.getByText(i18n.t('retry')));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(fetchMock.mock.calls.slice(1)).toEqual([
      ['http://backend/api/games?search=Portal'], ['http://backend/api/games?search=Portal'],
    ]);
  });
});
