import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../i18n';
import i18n from '../../i18n';
import EditPlaylistGameModal from '../EditPlaylistGameModal';

const backend = 'http://example.com';
process.env.NEXT_PUBLIC_BACKEND_URL = backend;

let origFetch: any;

beforeEach(() => {
  origFetch = (global as any).fetch;
});

afterEach(() => {
  (global as any).fetch = origFetch;
});

test('selects existing game', async () => {
  const fetchMock = jest.fn((url: string, opts?: any) => {
    if (url === `${backend}/api/games`) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ games: [{ id: 1, rawg_id: 10, name: 'Foo', background_image: null }] }),
      });
    }
    if (url === `${backend}/api/rawg_search?query=Foo`) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [{ rawg_id: 10, name: 'Foo', background_image: null }] }),
      });
    }
    if (url === `${backend}/api/playlist_game`) {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  (global as any).fetch = fetchMock;

  render(
    <EditPlaylistGameModal tag="tag" session={null} onClose={() => {}} onUpdated={() => {}} />
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`${backend}/api/games`));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Foo' } });
  fireEvent.click(screen.getByText(i18n.t('search')));
  await screen.findByText('Foo');
  expect(screen.getByText(i18n.t('alreadyExists'))).toBeInTheDocument();
  fireEvent.click(screen.getByText(i18n.t('select')));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${backend}/api/playlist_game`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tag: 'tag', game_id: 1 }),
      })
    )
  );
});

test('selects new game', async () => {
  const fetchMock = jest.fn((url: string, opts?: any) => {
    if (url === `${backend}/api/games`) {
      return Promise.resolve({ ok: true, json: async () => ({ games: [] }) });
    }
    if (url === `${backend}/api/rawg_search?query=Bar`) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [{ rawg_id: 20, name: 'Bar', background_image: '/img.png' }] }),
      });
    }
    if (url === `${backend}/api/playlist_game`) {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  (global as any).fetch = fetchMock;

  render(
    <EditPlaylistGameModal tag="tag" session={null} onClose={() => {}} onUpdated={() => {}} />
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`${backend}/api/games`));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Bar' } });
  fireEvent.click(screen.getByText(i18n.t('search')));
  await screen.findByText('Bar');
  expect(screen.getByText(i18n.t('new'))).toBeInTheDocument();
  fireEvent.click(screen.getByText(i18n.t('select')));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${backend}/api/playlist_game`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          tag: 'tag',
          game_name: 'Bar',
          rawg_id: 20,
          background_image: '/img.png',
        }),
      })
    )
  );
});
