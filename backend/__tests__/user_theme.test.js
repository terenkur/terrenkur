const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

let savedTheme = 'system';
let userExists = true;

const updateEqMock = jest
  .fn()
  .mockImplementation(async (column, value) => {
    expect(column).toBe('auth_id');
    expect(value).toBe('user1');
    return { error: null };
  });
const updateMock = jest.fn(({ theme }) => {
  savedTheme = theme;
  return { eq: updateEqMock };
});

const selectMock = jest.fn((columns) => {
  const maybeSingle = jest.fn(async () => {
    if (!userExists) {
      return { data: null, error: null };
    }
    if (columns === 'id') {
      return { data: { id: 123 }, error: null };
    }
    if (columns === 'theme') {
      return { data: { theme: savedTheme }, error: null };
    }
    return { data: null, error: null };
  });

  const eqMock = jest.fn((column, value) => {
    expect(column).toBe('auth_id');
    expect(value).toBe('user1');
    return { maybeSingle };
  });

  return { eq: eqMock };
});

const mockSupabase = {
  auth: {
    getUser: jest
      .fn()
      .mockResolvedValue({ data: { user: { id: 'user1' } }, error: null }),
  },
  from: jest.fn((table) => {
    if (table === 'users') return { update: updateMock, select: selectMock };
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
    savedTheme = 'system';
    userExists = true;
  });

  it("saves a user's theme and returns it", async () => {
    const updateRes = await request(app)
      .post('/api/user/theme')
      .set('Authorization', 'Bearer token123')
      .send({ theme: 'midnight' });

    expect(updateRes.status).toBe(200);
    expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('token123');
    expect(mockSupabase.from).toHaveBeenCalledWith('users');
    expect(selectMock).toHaveBeenCalledWith('id');
    expect(updateMock).toHaveBeenCalledWith({ theme: 'midnight' });
    expect(updateEqMock).toHaveBeenCalledWith('auth_id', 'user1');

    const getRes = await request(app)
      .get('/api/user/theme')
      .set('Authorization', 'Bearer token123');

    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual({ theme: 'midnight' });
    expect(selectMock).toHaveBeenCalledWith('theme');
  });

  it('returns 404 when no user record exists', async () => {
    userExists = false;

    const updateRes = await request(app)
      .post('/api/user/theme')
      .set('Authorization', 'Bearer token123')
      .send({ theme: 'midnight' });

    expect(updateRes.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();

    const getRes = await request(app)
      .get('/api/user/theme')
      .set('Authorization', 'Bearer token123');

    expect(getRes.status).toBe(404);
  });
});
