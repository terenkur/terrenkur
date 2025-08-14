import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../i18n';
import i18n from '../../i18n';
import AddCatalogGameModal from '../AddCatalogGameModal';

const backend = 'http://example.com';
process.env.NEXT_PUBLIC_BACKEND_URL = backend;

let origFetch: any;
beforeEach(() => {
  origFetch = (global as any).fetch;
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results: [{ rawg_id: 1, name: 'Game', background_image: null }] }),
  });
});

afterEach(() => {
  (global as any).fetch = origFetch;
});

test('searches and displays results', async () => {
  render(
    <AddCatalogGameModal session={null} onClose={() => {}} onAdded={() => {}} />
  );
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'foo' } });
  fireEvent.click(screen.getByText(i18n.t('search')));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(`${backend}/api/rawg_search?query=foo`));
  expect(await screen.findByText('Game')).toBeInTheDocument();
});

test('adds game and calls callbacks', async () => {
  const onAdded = jest.fn();
  const onClose = jest.fn();
  render(
    <AddCatalogGameModal
      session={{ access_token: 'tok' } as any}
      onClose={onClose}
      onAdded={onAdded}
    />
  );
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'foo' } });
  fireEvent.click(screen.getByText(i18n.t('search')));
  await screen.findByText('Game');
  fireEvent.click(screen.getByText(i18n.t('add')));
  await waitFor(() =>
    expect(global.fetch).toHaveBeenLastCalledWith(`${backend}/api/manage_game`, expect.any(Object))
  );
  expect(onAdded).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});
