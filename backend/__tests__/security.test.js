const { createSecurity, isModeratorFromAuth, requireAdminToken } = require('../security');

const response = () => ({ status: jest.fn(function () { return this; }), json: jest.fn(), set: jest.fn() });
function database(rows) {
  return {
    from: jest.fn(() => {
      let selected = rows, values, insert;
      const q = {
        select: () => q,
        eq: (key, value) => { selected = selected.filter(row => row[key] === value); return q; },
        is: (key, value) => { selected = selected.filter(row => row[key] === value); return q; },
        or: () => { selected = rows.filter(row => row.username?.toLowerCase() === 'bob'); return q; },
        update: value => { values = value; return q; },
        insert: value => { insert = value; return q; },
        maybeSingle: async () => {
          if (values) selected.forEach(row => Object.assign(row, values));
          if (insert) { const row = { id: rows.length + 1, ...insert }; rows.push(row); selected = [row]; }
          return { data: selected[0] || null, error: null };
        },
      };
      return q;
    }),
  };
}
const identity = { id: 'new-auth', identities: [{ provider: 'twitch', identity_data: { sub: '123' } }], user_metadata: { preferred_username: 'other-person', is_moderator: true } };
beforeEach(() => {
  process.env.ADMIN_TOKEN = 'fixture-admin';
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: '123', login: 'bob' }] }) }));
});
afterEach(() => jest.restoreAllMocks());

it('never trusts user-editable moderator metadata', () => {
  expect(isModeratorFromAuth(identity)).toBe(false);
  expect(isModeratorFromAuth({ app_metadata: { is_moderator: true } })).toBe(true);
  expect(isModeratorFromAuth({ app_metadata: { is_moderator: 'false' } })).toBe(false);
});
it.each([undefined, '', 'wrong'])('rejects absent or invalid administrator credentials: %s', value => {
  const res = response(), next = jest.fn();
  requireAdminToken({ headers: { 'x-admin-token': value } }, res, next);
  expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
});
it('fails closed when server ADMIN_TOKEN is missing', () => {
  delete process.env.ADMIN_TOKEN;
  const res = response(), next = jest.fn();
  requireAdminToken({ headers: {} }, res, next);
  expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
});
it('allows the configured administrator credential', () => {
  const next = jest.fn();
  requireAdminToken({ headers: { 'x-admin-token': 'fixture-admin' } }, response(), next);
  expect(next).toHaveBeenCalledTimes(1);
});
it('does not overwrite a profile already owned by another account', async () => {
  const rows = [{ id: 1, username: 'Bob', auth_id: 'original-owner' }];
  await expect(createSecurity(database(rows), async () => 'app-token').ensureProfile(identity)).rejects.toMatchObject({ status: 409 });
  expect(rows[0].auth_id).toBe('original-owner');
});
it('links an unclaimed profile using the verified Twitch id, not metadata', async () => {
  const rows = [{ id: 1, username: 'Bob', auth_id: null, is_moderator: false }];
  const user = await createSecurity(database(rows), async () => 'app-token').ensureProfile(identity);
  expect(user).toMatchObject({ auth_id: 'new-auth', twitch_login: 'bob', is_moderator: false });
  expect(global.fetch).toHaveBeenCalledWith('https://api.twitch.tv/helix/users?id=123', expect.any(Object));
});
it('does not accept a display name as proof of identity', async () => {
  const db = database([]);
  await expect(createSecurity(db, jest.fn()).ensureProfile({ id: 'x', user_metadata: { name: 'bob' } })).rejects.toMatchObject({ status: 403 });
  expect(global.fetch).not.toHaveBeenCalled();
});
it('creates a verified first-time profile with no moderator privilege', async () => {
  const rows = [];
  await createSecurity(database(rows), async () => 'app-token').ensureProfile(identity);
  expect(rows[0]).toMatchObject({ username: 'bob', twitch_login: 'bob', auth_id: 'new-auth' });
  expect(rows[0].is_moderator).toBeUndefined();
});
it('leaves an existing linked profile unchanged regardless of forged metadata', async () => {
  const rows = [{ id: 1, auth_id: 'new-auth', username: 'original', is_moderator: false }];
  await createSecurity(database(rows), jest.fn()).ensureProfile(identity);
  expect(rows[0]).toMatchObject({ username: 'original', is_moderator: false });
  expect(global.fetch).not.toHaveBeenCalled();
});
it('rejects invalid sessions before any profile access', async () => {
  const db = database([]); db.auth = { getUser: async () => ({ data: { user: null }, error: new Error('invalid') }) };
  const res = response(), next = jest.fn();
  await createSecurity(db, jest.fn()).requireAuth({ headers: { authorization: 'Bearer invalid' } }, res, next);
  expect(res.status).toHaveBeenCalledWith(401); expect(next).not.toHaveBeenCalled(); expect(db.from).not.toHaveBeenCalled();
});
