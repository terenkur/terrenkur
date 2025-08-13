const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

const updateEqMock = jest.fn().mockResolvedValue({ error: null });
const updateMock = jest.fn(() => ({ eq: updateEqMock }));
const maybeSingleMock = jest
  .fn()
  .mockResolvedValue({ data: { theme: 'dark' }, error: null });
const selectEqMock = jest.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = jest.fn(() => ({ eq: selectEqMock }));

const mockSupabase = {
  auth: {
    getUser: jest
      .fn()
      .mockResolvedValue({ data: { user: { id: 'user1' } }, error: null }),
  },
  from: jest.fn((table) => {
    if (table === 'profiles') return { update: updateMock, select: selectMock };
    return {};
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const app = require('../server');

describe('user theme API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates theme for current user', async () => {
    const res = await request(app)
      .post('/api/user/theme')
      .set('Authorization', 'Bearer token123')
      .send({ theme: 'dark' });
    expect(res.status).toBe(200);
    expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('token123');
    expect(updateMock).toHaveBeenCalledWith({ theme: 'dark' });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'user1');
  });

  it('returns current theme', async () => {
    const res = await request(app)
      .get('/api/user/theme')
      .set('Authorization', 'Bearer token123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ theme: 'dark' });
    expect(selectMock).toHaveBeenCalledWith('theme');
    expect(selectEqMock).toHaveBeenCalledWith('id', 'user1');
  });
});
