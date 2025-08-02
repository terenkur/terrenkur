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
});
