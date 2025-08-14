import { render, screen } from '@testing-library/react';
import SpinResultModal from '../SpinResultModal';
import '../../i18n';

const game = { id: 1, name: 'Test', count: 1 } as any;

it('shows eliminated game name', () => {
  render(<SpinResultModal eliminated={game} onClose={() => {}} />);
  expect(screen.getByText(/Вылетевшая игра: Test/)).toBeInTheDocument();
});
