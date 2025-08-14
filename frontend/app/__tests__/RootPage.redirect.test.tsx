import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({ redirect: jest.fn() }));

const Page = require('@/app/page').default;

describe('RootPage redirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('always redirects to /ru', () => {
    Page();
    expect(redirect).toHaveBeenCalledWith('/ru');
  });
});
