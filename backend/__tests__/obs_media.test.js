const request = require('supertest');

process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_KEY = 'test';

let isModerator = true;
let obsMediaData;
let insertedObsMedia;
let updatedObsMedia;
let deletedId;
let eventLogsFilter;
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
        update: jest.fn((row) => {
          updatedObsMedia = row;
          return {
            eq: jest.fn((col, val) => ({
              select: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({ data: { id: Number(val), ...row }, error: null })
                ),
              })),
            })),
          };
        }),
        delete: jest.fn(() => ({
          eq: jest.fn((col, val) => {
            deletedId = Number(val);
            return Promise.resolve({ data: null, error: null });
          }),
        })),
      };
    }
    if (table === 'event_logs') {
      return {
        select: jest.fn(() => ({
          order: jest.fn(() => {
            const builder = {};
            const resolveData = () => {
              const filterValue = builder.__filterValue || '';
              const type = filterValue.startsWith('poceluy')
                ? 'poceluy_no_tag_0'
                : 'intim_no_tag_0';
              return Promise.resolve({
                data: [{ id: 1, message: 'm', type }],
                error: null,
              });
            };
            builder.limit = jest.fn(resolveData);
            builder.eq = jest.fn((col, val) => {
              eventLogsFilter = { method: 'eq', column: col, value: val };
              builder.__filterValue = val;
              return builder;
            });
            builder.ilike = jest.fn((col, val) => {
              eventLogsFilter = { method: 'ilike', column: col, value: val };
              builder.__filterValue = val.replace(/%+$/u, '');
              return builder;
            });
            return builder;
          }),
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
      { id: 2, type: 'poceluy_no_tag_0', gif_url: 'g2', sound_url: 's2' },
    ];
    insertedObsMedia = null;
    updatedObsMedia = null;
    deletedId = null;
    eventLogsFilter = null;
    mockSupabase.from.mockClear();
  });

  it('GET /api/obs-media returns media', async () => {
    const res = await request(app)
      .get('/api/obs-media')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ media: obsMediaData, types: userColumns });
  });

  it('GET /api/obs-media?grouped=true returns grouped media', async () => {
    const res = await request(app)
      .get('/api/obs-media')
      .query({ grouped: 'true' })
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      media: {
        intim_no_tag_0: [obsMediaData[0]],
        poceluy_no_tag_0: [obsMediaData[1]],
      },
      types: userColumns,
    });
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

  it('PUT /api/obs-media/:id updates media', async () => {
    const res = await request(app)
      .put('/api/obs-media/1')
      .set('Authorization', 'Bearer token')
      .send({ gif_url: 'new', sound_url: 'snd' });
    expect(res.status).toBe(200);
    expect(updatedObsMedia).toEqual({ gif_url: 'new', sound_url: 'snd' });
    expect(res.body).toEqual({ media: { id: 1, gif_url: 'new', sound_url: 'snd' } });
  });

  it('DELETE /api/obs-media/:id removes media', async () => {
    const res = await request(app)
      .delete('/api/obs-media/1')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(deletedId).toBe(1);
  });
});

describe('GET /api/logs', () => {
  it('filters by type', async () => {
    const res = await request(app)
      .get('/api/logs')
      .query({ limit: 5, type: 'intim' });
    expect(res.status).toBe(200);
    expect(eventLogsFilter).toEqual({ method: 'ilike', column: 'type', value: 'intim%' });
    expect(res.body).toEqual({ logs: [{ id: 1, message: 'm', type: 'intim_no_tag_0' }] });
  });
});

