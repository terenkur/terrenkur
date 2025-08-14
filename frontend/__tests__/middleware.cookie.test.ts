jest.mock('next/server', () => ({
  NextResponse: {
    next: () => {
      const cookies = new Map<string, { value: string }>();
      return {
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

function createRequest(hasCookie = false) {
  return {
    cookies: { get: () => (hasCookie ? { value: 'ru' } : undefined) },
  } as any;
}

describe('middleware locale cookie', () => {
  it('sets cookie when missing', () => {
    const request = createRequest(false);
    const response = middleware(request);
    expect(response.cookies.get('i18nextLng')?.value).toBe('ru');
  });

  it('keeps existing cookie', () => {
    const request = createRequest(true);
    const response = middleware(request);
    expect(response.cookies.get('i18nextLng')).toBeUndefined();
  });
});

