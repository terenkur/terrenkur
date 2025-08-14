import { render, screen, fireEvent, waitFor } from '@testing-library/react';

process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend';

const GamesPage = require('@/app/[locale]/games/page').default;

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

    const searchInput = await screen.findByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'foo' } });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith('http://backend/api/games?search=foo');
  });
});

