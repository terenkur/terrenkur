import { redirect } from 'next/navigation';
import { cookies as mockCookies, headers as mockHeaders } from 'next/headers';

jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn(), headers: jest.fn() }));

const Page = require('@/app/page').default;

describe('RootPage locale redirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses locale from cookie', async () => {
    const get = jest.fn().mockReturnValue({ value: 'ru' });
    const set = jest.fn();
    (mockCookies as unknown as jest.Mock).mockResolvedValue({ get, set });
    (mockHeaders as unknown as jest.Mock).mockResolvedValue({ get: () => 'en-US' });

    await Page();

    expect(redirect).toHaveBeenCalledWith('/ru');
    expect(set).not.toHaveBeenCalled();
  });

  it('falls back to Accept-Language and sets cookie', async () => {
    const get = jest.fn().mockReturnValue(undefined);
    const set = jest.fn();
    (mockCookies as unknown as jest.Mock).mockResolvedValue({ get, set });
    (mockHeaders as unknown as jest.Mock).mockResolvedValue({ get: () => 'ru-RU,ru;q=0.9' });

    await Page();

    expect(set).toHaveBeenCalledWith('i18nextLng', 'ru');
    expect(redirect).toHaveBeenCalledWith('/ru');
  });

  it('defaults to en when nothing matches', async () => {
    const get = jest.fn().mockReturnValue(undefined);
    const set = jest.fn();
    (mockCookies as unknown as jest.Mock).mockResolvedValue({ get, set });
    (mockHeaders as unknown as jest.Mock).mockResolvedValue({ get: () => 'fr-FR,fr;q=0.9' });

    await Page();

    expect(set).toHaveBeenCalledWith('i18nextLng', 'en');
    expect(redirect).toHaveBeenCalledWith('/en');
  });
});
