const cookiesMap = new Map<string, { value: string }>();

jest.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) => ({
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'location' ? url.toString() : undefined,
      },
      cookies: {
        set: (name: string, value: string) => {
          cookiesMap.set(name, { value });
        },
        get: (name: string) => cookiesMap.get(name),
      },
    }),
  },
}));

const { middleware } = require('@/middleware');

function createRequest({
  cookie,
  acceptLanguage,
}: {
  cookie?: string;
  acceptLanguage?: string;
}) {
  const headers = new Map<string, string>();
  if (acceptLanguage) headers.set('accept-language', acceptLanguage);
  return {
    cookies: {
      get: (name: string) => {
        if (!cookie) return undefined;
        const found = cookie
          .split(';')
          .map((c) => c.trim())
          .find((c) => c.startsWith(`${name}=`));
        if (!found) return undefined;
        return { value: found.split('=')[1] } as const;
      },
    },
    headers: {
      get: (name: string) => headers.get(name),
    },
    url: 'https://example.com',
  } as any;
}

describe('middleware locale redirect', () => {
  beforeEach(() => cookiesMap.clear());

  it('uses locale from cookie', () => {
    const request = createRequest({ cookie: 'i18nextLng=ru' });
    const response = middleware(request);
    expect(response.headers.get('location')).toBe('https://example.com/ru');
    expect(response.cookies.get('i18nextLng')).toBeUndefined();
  });

  it('falls back to Accept-Language and sets cookie', () => {
    const request = createRequest({ acceptLanguage: 'ru-RU,ru;q=0.9' });
    const response = middleware(request);
    expect(response.headers.get('location')).toBe('https://example.com/ru');
    expect(response.cookies.get('i18nextLng')?.value).toBe('ru');
  });

  it('defaults to en when nothing matches', () => {
    const request = createRequest({ acceptLanguage: 'fr-FR,fr;q=0.9' });
    const response = middleware(request);
    expect(response.headers.get('location')).toBe('https://example.com/en');
    expect(response.cookies.get('i18nextLng')?.value).toBe('en');
  });
});
