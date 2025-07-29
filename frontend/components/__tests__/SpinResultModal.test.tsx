import { render, screen } from '@testing-library/react';
import SpinResultModal from '../SpinResultModal';

const game = { id: 1, name: 'Test', count: 1 } as any;

it('shows eliminated game name', () => {
  render(<SpinResultModal eliminated={game} onClose={() => {}} />);
  expect(screen.getByText(/Dropped game: Test/)).toBeInTheDocument();
});
