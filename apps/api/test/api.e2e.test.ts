import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness, onboardedUser } from './harness.js';

let h: Harness;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

describe('health & public catalogue', () => {
  it('reports healthy with a working DB connection as the least-privilege role', async () => {
    const res = await h.request('GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
  });

  it('lists seeded interests', async () => {
    const res = await h.request('GET', '/interests');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(20);
    expect(res.body[0]).toEqual({ slug: expect.any(String), label: expect.any(String) });
  });
});

describe('authentication', () => {
  it('rejects missing tokens with the standard error shape', async () => {
    const res = await h.request('GET', '/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({
      code: 'unauthenticated',
      requestId: expect.any(String),
    });
  });

  it('rejects tokens signed by another key and expired tokens', async () => {
    const user = await h.createUser();
    for (const opts of [{ foreignKey: true }, { expired: true }]) {
      const res = await h.request('GET', '/me', { token: await h.tokenFor(user.id, opts) });
      expect(res.status).toBe(401);
    }
  });

  it('returns the account for a valid token; Premium comes from the DB, not the token', async () => {
    const user = await h.createUser('ava@example.com');
    const res = await h.request('GET', '/me', { token: user.token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: user.id,
      email: 'ava@example.com',
      onboarded: false,
      profile: null,
      premium: { status: 'FREE', hasPremiumAccess: false },
      settings: { whoCanCall: 'followers', profileVisibility: 'public' },
    });
  });
});

describe('onboarding', () => {
  it('requires basics before a profile can be created', async () => {
    const user = await h.createUser();
    const res = await h.request('PUT', '/me/profile', {
      token: user.token,
      body: { username: 'early_bird', displayName: 'Early' },
    });
    expect(res.status).toBe(400);
  });

  it('age-gates under-18 users everywhere except /me', async () => {
    const user = await h.createUser();
    const basics = await h.request('PUT', '/me/basics', {
      token: user.token,
      body: { dateOfBirth: '2012-01-01', countryCode: 'GB' },
    });
    expect(basics.status).toBe(403);
    expect(basics.body.error.code).toBe('age_restricted');

    const discover = await h.request('GET', '/discover', { token: user.token });
    expect(discover.body.error.code).toBe('age_restricted');
    const me = await h.request('GET', '/me', { token: user.token });
    expect(me.status).toBe(200);
    expect(me.body.restriction).toBe('age');

    // Date of birth cannot be changed afterwards to get around the gate.
    const retry = await h.request('PUT', '/me/basics', {
      token: user.token,
      body: { dateOfBirth: '1990-01-01', countryCode: 'GB' },
    });
    expect(retry.status).toBe(403);
  });

  it('stores the data region from the country (D2)', async () => {
    const user = await h.createUser();
    await h.request('PUT', '/me/basics', {
      token: user.token,
      body: { dateOfBirth: '1992-02-02', countryCode: 'DE' },
    });
    const [row] = await h.admin`select data_region from app.users where id = ${user.id}`;
    expect(row?.data_region).toBe('eu');
  });

  it('runs the full flow and enforces unique and reserved usernames', async () => {
    const ava = await onboardedUser(h, { username: 'ava_lopez', interests: ['music', 'travel'] });
    const me = await h.request('GET', '/me', { token: ava.token });
    expect(me.body).toMatchObject({
      onboarded: true,
      hasDateOfBirth: true,
      countryCode: 'NG',
      profile: { username: 'ava_lopez' },
    });
    expect(me.body.profile.interests.map((i: { slug: string }) => i.slug).sort()).toEqual([
      'music',
      'travel',
    ]);

    const other = await h.createUser();
    await h.request('PUT', '/me/basics', {
      token: other.token,
      body: { dateOfBirth: '1990-01-01', countryCode: 'US' },
    });
    for (const username of ['AVA_LOPEZ', 'admin']) {
      const res = await h.request('PUT', '/me/profile', {
        token: other.token,
        body: { username, displayName: 'Copy' },
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('username_taken');
    }

    const availability = await h.request('GET', '/usernames/Ava_Lopez/availability');
    expect(availability.body).toMatchObject({ username: 'ava_lopez', available: false });
  });

  it('rejects unknown interests and invalid settings values', async () => {
    const user = await onboardedUser(h, { username: 'validator' });
    const bad = await h.request('PUT', '/me/profile', {
      token: user.token,
      body: { interests: ['not-a-real-interest'] },
    });
    expect(bad.status).toBe(400);
    const settings = await h.request('PATCH', '/me/settings', {
      token: user.token,
      body: { whoCanCall: 'aliens' },
    });
    expect(settings.status).toBe(400);
    expect(settings.body.error.code).toBe('validation_error');
  });
});

describe('avatar', () => {
  it('only accepts existing objects inside the user’s own folder', async () => {
    const user = await onboardedUser(h, { username: 'avatar_user' });
    const intruder = await onboardedUser(h, { username: 'intruder' });
    const path = `${user.id}/0f8b2a1c-avatar.webp`;

    const notUploaded = await h.request('PUT', '/me/avatar', { token: user.token, body: { path } });
    expect(notUploaded.status).toBe(400);

    h.avatarObjects.add(path);
    const stolen = await h.request('PUT', '/me/avatar', { token: intruder.token, body: { path } });
    expect(stolen.status).toBe(400);

    const ok = await h.request('PUT', '/me/avatar', { token: user.token, body: { path } });
    expect(ok.status).toBe(200);
    expect(ok.body.profile.avatarUrl).toBe(
      `http://supabase.test/storage/v1/object/public/avatars/${path}`,
    );
  });
});

describe('discover, profiles and follows', () => {
  let viewer: { id: string; token: string };
  let musician: { id: string; token: string };
  let stranger: { id: string; token: string };
  let privateUser: { id: string; token: string };

  beforeAll(async () => {
    viewer = await onboardedUser(h, { username: 'viewer_one', interests: ['music', 'gaming'] });
    musician = await onboardedUser(h, { username: 'sofia_marin', interests: ['music', 'gaming'] });
    stranger = await onboardedUser(h, { username: 'lucas_meyer', interests: ['books'] });
    privateUser = await onboardedUser(h, { username: 'quiet_one', interests: ['music'] });
    await h.request('PATCH', '/me/settings', {
      token: privateUser.token,
      body: { profileVisibility: 'private' },
    });
  });

  it('requires onboarding', async () => {
    const fresh = await h.createUser();
    const res = await h.request('GET', '/discover', { token: fresh.token });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('onboarding_required');
  });

  it('ranks shared interests first, excludes self, and paginates with a cursor', async () => {
    const first = await h.request('GET', '/discover?limit=2', { token: viewer.token });
    expect(first.status).toBe(200);
    const ids = first.body.data.map((c: { id: string }) => c.id);
    expect(ids).not.toContain(viewer.id);
    expect(ids[0]).toBe(musician.id); // 2 shared interests beats 1
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const next = await h.request('GET', `/discover?limit=50&cursor=${first.body.nextCursor}`, {
      token: viewer.token,
    });
    const nextIds = next.body.data.map((c: { id: string }) => c.id);
    expect(nextIds.some((id: string) => ids.includes(id))).toBe(false);
  });

  it('filters by interest and searches by name', async () => {
    const books = await h.request('GET', '/discover?interests=books', { token: viewer.token });
    expect(books.body.data.map((c: { id: string }) => c.id)).toEqual([stranger.id]);

    const search = await h.request('GET', '/users/search?q=sofia', { token: viewer.token });
    expect(search.body.data[0]).toMatchObject({ id: musician.id, username: 'sofia_marin' });
  });

  it('follows a public profile immediately and keeps counters in step', async () => {
    const res = await h.request('POST', `/users/${musician.id}/follow`, { token: viewer.token });
    expect(res.body).toEqual({ status: 'active' });
    const again = await h.request('POST', `/users/${musician.id}/follow`, { token: viewer.token });
    expect(again.body).toEqual({ status: 'active' });

    const profile = await h.request('GET', '/users/@sofia_marin', { token: viewer.token });
    expect(profile.body.stats.followers).toBe(1);
    expect(profile.body.relationship).toMatchObject({ following: true });

    const followers = await h.request('GET', `/users/${musician.id}/followers`, {
      token: stranger.token,
    });
    expect(followers.body.data.map((c: { id: string }) => c.id)).toEqual([viewer.id]);

    await h.request('DELETE', `/users/${musician.id}/follow`, { token: viewer.token });
    const after = await h.request('GET', `/users/${musician.id}`, { token: viewer.token });
    expect(after.body.stats.followers).toBe(0);
  });

  it('hides private profile details until a follow request is accepted', async () => {
    const before = await h.request('GET', '/users/quiet_one', { token: viewer.token });
    expect(before.body).toMatchObject({ restricted: true, bio: null, interests: [] });
    const lists = await h.request('GET', `/users/${privateUser.id}/followers`, {
      token: viewer.token,
    });
    expect(lists.status).toBe(404);

    const req = await h.request('POST', `/users/${privateUser.id}/follow`, { token: viewer.token });
    expect(req.body).toEqual({ status: 'requested' });

    const inbox = await h.request('GET', '/follow-requests', { token: privateUser.token });
    expect(inbox.body.data.map((c: { id: string }) => c.id)).toEqual([viewer.id]);

    const accepted = await h.request('POST', `/follow-requests/${viewer.id}/accept`, {
      token: privateUser.token,
    });
    expect(accepted.body).toEqual({ status: 'active' });

    const afterAccept = await h.request('GET', '/users/quiet_one', { token: viewer.token });
    expect(afterAccept.body.restricted).toBe(false);
    expect(afterAccept.body.interests.map((i: { slug: string }) => i.slug)).toEqual(['music']);
  });

  it('serves public profiles to signed-out visitors without relationship data', async () => {
    const res = await h.request('GET', '/users/lucas_meyer');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'lucas_meyer', relationship: null });
  });

  it('makes blocked users invisible in both directions', async () => {
    await h.admin`insert into app.blocks (blocker_id, blocked_id) values (${stranger.id}, ${viewer.id})`;

    const profile = await h.request('GET', `/users/${stranger.id}`, { token: viewer.token });
    expect(profile.status).toBe(404);
    const follow = await h.request('POST', `/users/${stranger.id}/follow`, { token: viewer.token });
    expect(follow.status).toBe(404);
    const discover = await h.request('GET', '/discover?limit=50', { token: viewer.token });
    expect(discover.body.data.map((c: { id: string }) => c.id)).not.toContain(stranger.id);
    const search = await h.request('GET', '/users/search?q=lucas', { token: viewer.token });
    expect(search.body.data).toHaveLength(0);
  });

  it('never lists suspended accounts', async () => {
    await h.admin`update app.users set status = 'suspended' where id = ${musician.id}`;
    const res = await h.request('GET', `/users/${musician.id}`, { token: viewer.token });
    expect(res.status).toBe(404);
    const own = await h.request('GET', '/discover', { token: musician.token });
    expect(own.body.error.code).toBe('account_restricted');
  });
});
