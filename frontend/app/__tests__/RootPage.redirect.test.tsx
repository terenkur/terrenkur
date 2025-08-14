import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({ redirect: jest.fn() }));

const cookieGet = jest.fn();
const cookieSet = jest.fn();
const headersGet = jest.fn();

jest.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: cookieGet,
      set: cookieSet,
    }),
  headers: () => ({
    get: headersGet,
  }),
}));

const Page = require('@/app/page').default;

describe('RootPage redirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to locale from cookie', async () => {
    cookieGet.mockReturnValue({ value: 'ru' });
    await Page();
    expect(redirect).toHaveBeenCalledWith('/ru');
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('detects locale from headers and sets cookie', async () => {
    cookieGet.mockReturnValue(undefined);
    headersGet.mockReturnValue('ru-RU,ru;q=0.9');
    await Page();
    expect(redirect).toHaveBeenCalledWith('/ru');
    expect(cookieSet).toHaveBeenCalledWith('i18nextLng', 'ru');
  });
});
