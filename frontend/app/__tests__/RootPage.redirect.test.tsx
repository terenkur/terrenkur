import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({ redirect: jest.fn() }));

const Page = require('@/app/page').default;

describe('RootPage redirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to locale placeholder', () => {
    Page();
    expect(redirect).toHaveBeenCalledWith('/[locale]');
  });
});
