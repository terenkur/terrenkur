import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import ThemeToggle from '../ThemeToggle';

const setTheme = jest.fn();

jest.mock('next-themes', () => ({
  useTheme: () => ({ setTheme, resolvedTheme: 'light' }),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div onClick={onClick}>{children}</div>
  ),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it('sends request to save selected theme', async () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByText('Dark'));
    await waitFor(() => {
      expect(setTheme).toHaveBeenCalledWith('dark');
      expect(fetch).toHaveBeenCalledWith(
        '/api/user/theme',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: 'dark' }),
        })
      );
    });
  });
});
