import { render, screen, waitFor } from '@testing-library/react';

process.env.NEXT_PUBLIC_BACKEND_URL = 'http://backend';

import EventLog from '../EventLog';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));

describe('EventLog', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('network'));
  });

  it('handles fetch errors gracefully', async () => {
    render(<EventLog />);
    await waitFor(() =>
      expect(screen.getByText('Failed to fetch logs')).toBeInTheDocument()
    );
  });

  it('renders media preview when available', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        logs: [
          {
            id: 1,
            message: 'test',
            created_at: '2024-01-01T00:00:00Z',
            media_url: 'http://media',
            preview_url: 'http://preview',
          },
        ],
      }),
    });

    render(<EventLog />);

    const img = await screen.findByAltText('test');
    expect(img.getAttribute('src')).toContain('preview');
    expect(img.closest('a')).toHaveAttribute('href', 'http://media');
  });
});
