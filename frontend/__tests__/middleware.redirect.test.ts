jest.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) => {
      const cookies = new Map<string, { value: string }>();
      return {
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'location' ? url.toString() : undefined,
        },
        cookies: {
          get: (name: string) => cookies.get(name),
          set: (name: string, value: string) => {
            cookies.set(name, { value });
          },
        },
      };
    },
  },
}));

const { middleware } = require('@/middleware');

function createRequest() {
  return {
    url: 'https://example.com',
    cookies: { get: () => undefined },
  } as any;
}

describe('middleware locale redirect', () => {
  it('always redirects to /ru and sets cookie', () => {
    const request = createRequest();
    const response = middleware(request);
    expect(response.headers.get('location')).toBe('https://example.com/ru');
    expect(response.cookies.get('i18nextLng')?.value).toBe('ru');
  });
});
