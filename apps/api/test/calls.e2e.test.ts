import { decodeJwt } from 'jose';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness, onboardedUser } from './harness.js';

let h: Harness;
let ava: { id: string; token: string };
let ravi: { id: string; token: string };

beforeAll(async () => {
  h = await createHarness();
  ava = await onboardedUser(h, { username: 'ava_caller' });
  ravi = await onboardedUser(h, { username: 'ravi_callee' });
});

afterAll(async () => {
  await h?.close();
});

/** Calls and blocks leak state between cases, so reset the pair before each test. */
beforeEach(async () => {
  await h.admin`update app.call_sessions set status = 'ended', ended_at = now(), duration_seconds = 0 where status in ('ringing','active')`;
  await h.admin`delete from app.blocks`;
  await h.admin`update app.user_settings set who_can_call = 'everyone'`;
});

describe('starting a call', () => {
  it('rings the callee and returns LiveKit credentials scoped to that room', async () => {
    const res = await h.request('POST', '/calls', {
      token: ava.token,
      body: { calleeId: ravi.id },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'ringing',
      direction: 'outgoing',
      peer: { id: ravi.id, username: 'ravi_callee' },
    });

    const claims = decodeJwt(res.body.credentials.token) as {
      sub: string;
      video: { room: string; roomJoin: boolean; canPublish: boolean };
    };
    expect(claims.sub).toBe(`u:${ava.id}`);
    expect(claims.video.room).toBe(res.body.credentials.roomName);
    expect(claims.video).toMatchObject({ roomJoin: true, canPublish: true });
    expect(res.body.credentials.roomName).toMatch(/^call_/);
    // The token must not be usable anywhere else.
    expect(res.body.credentials.roomName).not.toContain(ava.id);
  });

  it('refuses self-calls, unknown users and blocked users', async () => {
    const self = await h.request('POST', '/calls', {
      token: ava.token,
      body: { calleeId: ava.id },
    });
    expect(self.status).toBe(400);

    const ghost = await h.request('POST', '/calls', {
      token: ava.token,
      body: { calleeId: randomUUID() },
    });
    expect(ghost.status).toBe(404);

    await h.admin`insert into app.blocks (blocker_id, blocked_id) values (${ravi.id}, ${ava.id})`;
    const blocked = await h.request('POST', '/calls', {
      token: ava.token,
      body: { calleeId: ravi.id },
    });
    expect(blocked.status).toBe(404);
  });

  it('honours "who can call me"', async () => {
    await h.admin`update app.user_settings set who_can_call = 'nobody' where user_id = ${ravi.id}`;
    const nobody = await h.request('POST', '/calls', {
      token: ava.token,
      body: { calleeId: ravi.id },
    });
    expect(nobody.status).toBe(403);
    expect(nobody.body.error.code).toBe('privacy_restricted');

    await h.admin`update app.user_settings set who_can_call = 'followers' where user_id = ${ravi.id}`;
    const notFollowing = await h.request('POST', '/calls', {
      token: ava.token,
      body: { calleeId: ravi.id },
    });
    expect(notFollowing.status).toBe(403);

    await h.request('POST', `/users/${ravi.id}/follow`, { token: ava.token });
    const following = await h.request('POST', '/calls', {
      token: ava.token,
      body: { calleeId: ravi.id },
    });
    expect(following.status).toBe(201);
    await h.request('DELETE', `/users/${ravi.id}/follow`, { token: ava.token });
  });

  it('rejects a second call while either side is busy', async () => {
    await h.request('POST', '/calls', { token: ava.token, body: { calleeId: ravi.id } });
    const third = await onboardedUser(h, { username: `busy_${Date.now().toString(36)}` });

    const callingBusyCallee = await h.request('POST', '/calls', {
      token: third.token,
      body: { calleeId: ravi.id },
    });
    expect(callingBusyCallee.status).toBe(409);
    expect(callingBusyCallee.body.error.code).toBe('user_busy');

    const callerAlreadyBusy = await h.request('POST', '/calls', {
      token: ava.token,
      body: { calleeId: third.id },
    });
    expect(callerAlreadyBusy.status).toBe(409);
  });
});

describe('answering and ending', () => {
  async function ring() {
    const res = await h.request('POST', '/calls', {
      token: ava.token,
      body: { calleeId: ravi.id },
    });
    return res.body as { id: string; credentials: { roomName: string } };
  }

  it('lets only the callee accept, and only while ringing', async () => {
    const call = await ring();
    const wrongPerson = await h.request('POST', `/calls/${call.id}/accept`, { token: ava.token });
    expect(wrongPerson.status).toBe(403);

    const accepted = await h.request('POST', `/calls/${call.id}/accept`, { token: ravi.token });
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('active');
    expect(accepted.body.credentials.roomName).toBe(call.credentials.roomName);

    const again = await h.request('POST', `/calls/${call.id}/accept`, { token: ravi.token });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('call_not_ringing');
  });

  it('records a duration and closes the room when a call ends', async () => {
    const call = await ring();
    await h.request('POST', `/calls/${call.id}/accept`, { token: ravi.token });
    const ended = await h.request('POST', `/calls/${call.id}/end`, { token: ava.token });
    expect(ended.status).toBe(200);
    expect(ended.body).toMatchObject({ status: 'ended', endReason: 'hangup' });
    expect(ended.body.durationSeconds).toBeGreaterThanOrEqual(0);

    const [room] = await h.admin`
      select vr.status from app.video_rooms vr
      join app.call_sessions cs on cs.room_id = vr.id where cs.id = ${call.id}`;
    expect(room?.status).toBe('closed');

    const token = await h.request('POST', `/calls/${call.id}/token`, { token: ava.token });
    expect(token.status).toBe(409);
    expect(token.body.error.code).toBe('room_unavailable');
  });

  it('maps hanging up while ringing to cancelled (caller) or declined (callee)', async () => {
    const a = await ring();
    const canceled = await h.request('POST', `/calls/${a.id}/end`, { token: ava.token });
    expect(canceled.body.status).toBe('canceled');

    const b = await ring();
    const declined = await h.request('POST', `/calls/${b.id}/decline`, { token: ravi.token });
    expect(declined.body.status).toBe('declined');
  });

  it('keeps non-participants out of a call entirely', async () => {
    const call = await ring();
    const stranger = await onboardedUser(h, { username: `nosy_${Date.now().toString(36)}` });
    for (const path of [`/calls/${call.id}`, `/calls/${call.id}/token`]) {
      const res = await h.request(path.endsWith('token') ? 'POST' : 'GET', path, {
        token: stranger.token,
      });
      expect(res.status).toBe(404);
    }
  });

  it('marks unanswered calls missed and notifies the callee', async () => {
    const call = await ring();
    // Pretend the ring started long ago, then let the sweeper run.
    await h.admin`update app.call_sessions set ring_started_at = now() - interval '2 minutes' where id = ${call.id}`;
    await new Promise((r) => setTimeout(r, 6_000));

    const summary = await h.request('GET', `/calls/${call.id}`, { token: ravi.token });
    expect(summary.body.status).toBe('missed');
    const [notification] = await h.admin`
      select type from app.notifications where entity_id = ${call.id} and user_id = ${ravi.id}`;
    expect(notification?.type).toBe('call.missed');
  }, 15_000);
});

describe('call history', () => {
  it('lists calls for both sides with the right direction and filters', async () => {
    const start = await h.request('POST', '/calls', {
      token: ava.token,
      body: { calleeId: ravi.id },
    });
    await h.request('POST', `/calls/${start.body.id}/decline`, { token: ravi.token });

    const mine = await h.request('GET', '/calls/history', { token: ava.token });
    expect(mine.body.data[0]).toMatchObject({ direction: 'outgoing', peer: { id: ravi.id } });

    const theirs = await h.request('GET', '/calls/history?filter=incoming', { token: ravi.token });
    expect(theirs.body.data[0]).toMatchObject({ direction: 'incoming', peer: { id: ava.id } });

    const outgoingForCallee = await h.request('GET', '/calls/history?filter=outgoing', {
      token: ravi.token,
    });
    expect(outgoingForCallee.body.data).toHaveLength(0);
  });
});

describe('LiveKit webhooks', () => {
  it('rejects unsigned bodies', async () => {
    const res = await h.request('POST', '/webhooks/livekit', {
      body: { event: 'participant_joined', room: { name: 'call_x' } },
    });
    expect(res.status).toBe(401);
  });
});

describe('blocking and reporting', () => {
  it('ends a live call, drops follows and hides both users', async () => {
    await h.request('POST', `/users/${ravi.id}/follow`, { token: ava.token });
    const call = await h.request('POST', '/calls', {
      token: ava.token,
      body: { calleeId: ravi.id },
    });
    await h.request('POST', `/calls/${call.body.id}/accept`, { token: ravi.token });

    const blocked = await h.request('POST', '/blocks', {
      token: ravi.token,
      body: { userId: ava.id, reason: 'harassment' },
    });
    expect(blocked.status).toBe(200);

    const summary = await h.request('GET', `/calls/${call.body.id}`, { token: ava.token });
    expect(summary.body.status).toBe('ended');
    expect(summary.body.endReason).toBe('blocked');

    const [follow] = await h.admin`
      select 1 from app.follows where follower_id = ${ava.id} and followee_id = ${ravi.id}`;
    expect(follow).toBeUndefined();

    const profile = await h.request('GET', `/users/${ravi.id}`, { token: ava.token });
    expect(profile.status).toBe(404);

    const list = await h.request('GET', '/blocks', { token: ravi.token });
    expect(list.body[0]).toMatchObject({ id: ava.id, username: 'ava_caller' });

    await h.request('DELETE', `/blocks/${ava.id}`, { token: ravi.token });
    const afterUnblock = await h.request('GET', `/users/${ravi.id}`, { token: ava.token });
    expect(afterUnblock.status).toBe(200);
  });

  it('files reports and prioritises urgent reasons', async () => {
    const normal = await h.request('POST', '/reports', {
      token: ava.token,
      body: { targetType: 'user', targetId: ravi.id, reason: 'spam', details: 'unsolicited links' },
    });
    expect(normal.status).toBe(201);

    const urgent = await h.request('POST', '/reports', {
      token: ava.token,
      body: { targetType: 'user', targetId: ravi.id, reason: 'minor_safety' },
    });
    expect(urgent.status).toBe(201);

    const rows = await h.admin`
      select reason, priority, target_user_id, status from app.reports where reporter_id = ${ava.id}
      order by priority`;
    expect(rows[0]).toMatchObject({
      reason: 'minor_safety',
      priority: 1,
      target_user_id: ravi.id,
      status: 'open',
    });
    expect(rows[1]?.priority).toBe(3);

    const self = await h.request('POST', '/reports', {
      token: ava.token,
      body: { targetType: 'user', targetId: ava.id, reason: 'spam' },
    });
    expect(self.status).toBe(400);
  });
});
