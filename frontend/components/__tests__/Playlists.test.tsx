import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../i18n';
import i18n from '../../i18n';

process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend';

const PlaylistsPage = require('@/app/playlists/page').default;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(),
  },
}));

const { supabase: mockSupabase } = require('@/lib/supabase');

describe('PlaylistsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders game next to playlist', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rpg: {
            videos: [],
            game: { id: 1, name: 'Game1', background_image: '/img.png' },
          },
        }),
      });

    render(<PlaylistsPage />);
    const heading = await screen.findByRole('heading', { level: 2, name: 'Game1' });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('text-white');
    expect(screen.queryByText(/#rpg/)).not.toBeInTheDocument();
  });

  it('filters playlists based on search query', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rpg: { videos: [], game: null },
        fps: { videos: [], game: null },
      }),
    });

    render(<PlaylistsPage />);

    await screen.findByText('#rpg');
    expect(screen.getByText('#fps')).toBeInTheDocument();

    const input = screen.getByLabelText('Search hashtags');
    fireEvent.change(input, { target: { value: 'rpg' } });

    expect(screen.getByText('#rpg')).toBeInTheDocument();
    expect(screen.queryByText('#fps')).not.toBeInTheDocument();
  });

  it('opens modal and sends request as moderator', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rpg: { videos: [], game: null } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          games: [{ id: 2, rawg_id: 20, name: 'Game2', background_image: null }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ rawg_id: 20, name: 'Game2', background_image: null }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rpg: { videos: [], game: { id: 2, name: 'Game2', background_image: null } },
        }),
      });
    (global as any).fetch = fetchMock;

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token', user: { id: '1' } } },
    });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(() =>
                Promise.resolve({ data: { is_moderator: true } })
              ),
            })),
          })),
        };
      }
      return {} as any;
    });

    render(<PlaylistsPage />);

    const editButton = await screen.findByText('Изменить игру');
    fireEvent.click(editButton);

    await screen.findByText(i18n.t('selectGameFor', { tag: 'rpg' }));

    const searchBox = screen.getAllByRole('textbox')[1];
    fireEvent.change(searchBox, { target: { value: 'Game2' } });
    fireEvent.click(screen.getByText(i18n.t('search')));

    const selectButton = await screen.findByText(i18n.t('select'));
    fireEvent.click(selectButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://backend/api/playlist_game',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
          body: JSON.stringify({ tag: 'rpg', game_id: 2 }),
        })
      )
    );
  });
});

