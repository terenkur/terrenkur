jest.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) => ({
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'location' ? url.toString() : undefined,
      },
    }),
  },
}));

const { middleware } = require('@/middleware');

function createRequest() {
  return {
    url: 'https://example.com',
  } as any;
}

describe('middleware locale redirect', () => {
  it('always redirects to /ru', () => {
    const request = createRequest();
    const response = middleware(request);
    expect(response.headers.get('location')).toBe('https://example.com/ru');
  });
});
