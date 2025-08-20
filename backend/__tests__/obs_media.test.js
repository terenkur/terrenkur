const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

let isModerator = true;
let obsMediaData;
let insertedObsMedia;
let eventLogsEq;
let userColumns;

const mockSupabase = {
  auth: {
    getUser: jest.fn(() => ({ data: { user: { id: '1', email: 'mod@test' } }, error: null })),
  },
  from: jest.fn((table) => {
    if (table === 'users') {
      return {
        select: jest.fn((cols) => {
          if (cols === 'is_moderator') {
            return {
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() =>
                  Promise.resolve({ data: { is_moderator: isModerator } })
                ),
              })),
            };
          }
          if (cols === '*') {
            return {
              limit: jest.fn(() =>
                Promise.resolve({
                  data: [userColumns.reduce((o, c) => ({ ...o, [c]: 0 }), {})],
                  error: null,
                })
              ),
            };
          }
          return {
            limit: jest.fn(() =>
              Promise.resolve({ data: null, error: { message: 'invalid column' } })
            ),
          };
        }),
      };
    }
    if (table === 'obs_media') {
      return {
        select: jest.fn(() => {
          const result = Promise.resolve({ data: obsMediaData, error: null });
          result.eq = jest.fn(() => Promise.resolve({ data: obsMediaData, error: null }));
          return result;
        }),
        insert: jest.fn((row) => {
          insertedObsMedia = row;
          return {
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({ data: { id: 2, ...row }, error: null })
              ),
            })),
          };
        }),
      };
    }
    if (table === 'event_logs') {
      return {
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            eq: jest.fn((col, val) => {
              eventLogsEq = [col, val];
              return {
                limit: jest.fn(() =>
                  Promise.resolve({ data: [{ id: 1, message: 'm', type: val }], error: null })
                ),
              };
            }),
          })),
        })),
      };
    }
    return {};
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const app = require('../server');

describe('OBS media endpoints', () => {
  beforeEach(() => {
    isModerator = true;
    userColumns = ['intim_no_tag_0', 'poceluy_no_tag_0'];
    obsMediaData = [
      { id: 1, type: 'intim_no_tag_0', gif_url: 'g', sound_url: 's' },
    ];
    insertedObsMedia = null;
    eventLogsEq = null;
    mockSupabase.from.mockClear();
  });

  it('GET /api/obs-media returns media', async () => {
    const res = await request(app)
      .get('/api/obs-media')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ media: obsMediaData });
  });

  it('POST /api/obs-media inserts media', async () => {
    const newItem = { type: 'poceluy_no_tag_0', gif_url: 'g2', sound_url: 's2' };
    const res = await request(app)
      .post('/api/obs-media')
      .set('Authorization', 'Bearer token')
      .send(newItem);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ media: { id: 2, ...newItem } });
    expect(insertedObsMedia).toEqual(newItem);
  });

  it('POST /api/obs-media rejects invalid type', async () => {
    const res = await request(app)
      .post('/api/obs-media')
      .set('Authorization', 'Bearer token')
      .send({ type: 'invalid', gif_url: 'g', sound_url: 's' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/logs', () => {
  it('filters by type', async () => {
    const res = await request(app)
      .get('/api/logs')
      .query({ limit: 5, type: 'intim' });
    expect(res.status).toBe(200);
    expect(eventLogsEq).toEqual(['type', 'intim']);
    expect(res.body).toEqual({ logs: [{ id: 1, message: 'm', type: 'intim' }] });
  });
});

