import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness, onboardedUser } from './harness.js';

let h: Harness;
let moderator: { id: string; token: string };
let admin: { id: string; token: string };
let reporter: { id: string; token: string };
let offender: { id: string; token: string };

async function grantStaff(userId: string, role: string) {
  await h.admin`
    insert into app.admin_users (user_id, role) values (${userId}, ${role})
    on conflict (user_id) do update set role = ${role}, disabled_at = null`;
}

async function fileReport(reason = 'harassment') {
  const res = await h.request('POST', '/reports', {
    token: reporter.token,
    body: { targetType: 'user', targetId: offender.id, reason, details: 'test report' },
  });
  return res.body.id as string;
}

beforeAll(async () => {
  h = await createHarness();
  moderator = await onboardedUser(h, { username: 'mod_marie' });
  admin = await onboardedUser(h, { username: 'admin_ana' });
  reporter = await onboardedUser(h, { username: 'rep_rita' });
  offender = await onboardedUser(h, { username: 'off_oscar' });
  await grantStaff(moderator.id, 'moderator');
  await grantStaff(admin.id, 'admin');
});

afterAll(async () => {
  await h?.close();
});

beforeEach(async () => {
  await h.admin`delete from app.reports`;
  await h.admin`delete from app.moderation_actions`;
  await h.admin`update app.users set status = 'active' where id = ${offender.id}`;
});

describe('staff access', () => {
  it('hides every admin route from ordinary users', async () => {
    for (const [method, path] of [
      ['GET', '/admin/me'],
      ['GET', '/admin/reports'],
      ['GET', '/admin/metrics/overview'],
      ['GET', `/admin/users/${offender.id}`],
      ['GET', '/admin/audit-log'],
    ] as const) {
      const res = await h.request(method, path, { token: reporter.token });
      // 404, not 403: a normal user shouldn't learn that these routes exist.
      expect(res.status, `${method} ${path}`).toBe(404);
    }
  });

  it('rejects unauthenticated callers', async () => {
    expect((await h.request('GET', '/admin/reports')).status).toBe(401);
  });

  it('identifies the signed-in staff member and their role', async () => {
    const res = await h.request('GET', '/admin/me', { token: moderator.token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: moderator.id, role: 'moderator', mfa: false });
  });

  it('keeps disabled staff out', async () => {
    await h.admin`update app.admin_users set disabled_at = now() where user_id = ${moderator.id}`;
    expect((await h.request('GET', '/admin/reports', { token: moderator.token })).status).toBe(404);
    await h.admin`update app.admin_users set disabled_at = null where user_id = ${moderator.id}`;
  });
});

describe('report queue', () => {
  it('orders urgent reports first and carries context about both people', async () => {
    await fileReport('spam');
    await fileReport('minor_safety');

    const res = await h.request('GET', '/admin/reports', { token: moderator.token });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      reason: 'minor_safety',
      priority: 1,
      status: 'open',
      reporter: { username: 'rep_rita' },
      target: { username: 'off_oscar', status: 'active' },
    });
    expect(res.body.data[0].priorReports).toBe(2);
    expect(res.body.data[1].reason).toBe('spam');
  });

  it('filters by status and reason', async () => {
    const id = await fileReport('scam');
    await fileReport('spam');

    const scams = await h.request('GET', '/admin/reports?reason=scam', { token: moderator.token });
    expect(scams.body.data.map((r: { id: string }) => r.id)).toEqual([id]);

    await h.request('PATCH', `/admin/reports/${id}`, {
      token: moderator.token,
      body: { status: 'resolved', resolutionNote: 'warned them' },
    });
    const open = await h.request('GET', '/admin/reports?status=open', { token: moderator.token });
    expect(open.body.data.map((r: { id: string }) => r.id)).not.toContain(id);

    const resolved = await h.request('GET', '/admin/reports?status=resolved', {
      token: moderator.token,
    });
    expect(resolved.body.data.map((r: { id: string }) => r.id)).toEqual([id]);
    // The note itself lives on the detail view.
    const detail = await h.request('GET', `/admin/reports/${id}`, { token: moderator.token });
    expect(detail.body.resolutionNote).toBe('warned them');
  });

  it('assigns a report and records the decision in the audit log', async () => {
    const id = await fileReport();
    const assigned = await h.request('PATCH', `/admin/reports/${id}`, {
      token: moderator.token,
      body: { assignToMe: true, status: 'in_review' },
    });
    expect(assigned.body).toMatchObject({ status: 'in_review', assignedTo: moderator.id });

    const log = await h.request('GET', '/admin/audit-log', { token: admin.token });
    expect(log.body.data[0]).toMatchObject({ action: 'report.in_review', targetId: id });
  });

  it('lets support read but not decide', async () => {
    const id = await fileReport();
    const support = await onboardedUser(h, { username: `sup_${Date.now().toString(36)}` });
    await grantStaff(support.id, 'support');

    expect((await h.request('GET', '/admin/reports', { token: support.token })).status).toBe(200);
    const patch = await h.request('PATCH', `/admin/reports/${id}`, {
      token: support.token,
      body: { status: 'dismissed' },
    });
    expect(patch.status).toBe(403);
  });
});

describe('acting on people', () => {
  it('suspends an account, ends its calls and blocks it from the app', async () => {
    const victim = await onboardedUser(h, { username: `vic_${Date.now().toString(36)}` });
    const call = await h.request('POST', '/calls', {
      token: offender.token,
      body: { calleeId: victim.id },
    });
    await h.request('POST', `/calls/${call.body.id}/accept`, { token: victim.token });

    const res = await h.request('POST', `/admin/users/${offender.id}/actions`, {
      token: moderator.token,
      body: { action: 'suspend', reason: 'harassment in calls' },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'suspended', id: offender.id });
    expect(res.body.history[0]).toMatchObject({ action: 'suspend', reason: 'harassment in calls' });

    // The live call is over…
    const summary = await h.request('GET', `/calls/${call.body.id}`, { token: victim.token });
    expect(summary.body).toMatchObject({ status: 'ended', endReason: 'moderation' });

    // …and the suspended account can no longer use the app.
    const blocked = await h.request('GET', '/discover', { token: offender.token });
    expect(blocked.body.error.code).toBe('account_restricted');
  });

  it('needs an admin to ban or unban', async () => {
    const asModerator = await h.request('POST', `/admin/users/${offender.id}/actions`, {
      token: moderator.token,
      body: { action: 'ban', reason: 'repeat offender' },
    });
    expect(asModerator.status).toBe(403);

    const asAdmin = await h.request('POST', `/admin/users/${offender.id}/actions`, {
      token: admin.token,
      body: { action: 'ban', reason: 'repeat offender' },
    });
    expect(asAdmin.body.status).toBe('banned');

    const lifted = await h.request('POST', `/admin/users/${offender.id}/actions`, {
      token: admin.token,
      body: { action: 'unban', reason: 'appeal upheld' },
    });
    expect(lifted.body.status).toBe('active');
    // Unbanning revokes the earlier ban rather than deleting the record.
    const ban = lifted.body.history.find((h: { action: string }) => h.action === 'ban');
    expect(ban.revokedAt).not.toBeNull();
  });

  it('refuses self-moderation and unknown accounts', async () => {
    const self = await h.request('POST', `/admin/users/${moderator.id}/actions`, {
      token: moderator.token,
      body: { action: 'suspend', reason: 'oops' },
    });
    expect(self.status).toBe(400);

    const ghost = await h.request(
      'POST',
      `/admin/users/11111111-1111-4111-8111-111111111111/actions`,
      {
        token: moderator.token,
        body: { action: 'warn', reason: 'nobody' },
      },
    );
    expect(ghost.status).toBe(404);
  });

  it('validates the action payload', async () => {
    for (const body of [
      { action: 'warn' },
      { action: 'warn', reason: 'x' },
      { action: 'ban', reason: 'valid reason', expiresAt: new Date().toISOString() },
      { action: 'not_a_real_action', reason: 'valid reason' },
    ]) {
      const res = await h.request('POST', `/admin/users/${offender.id}/actions`, {
        token: admin.token,
        body,
      });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe('overview and people search', () => {
  it('counts what the dashboard shows', async () => {
    await fileReport('minor_safety');
    const res = await h.request('GET', '/admin/metrics/overview', { token: moderator.token });
    expect(res.status).toBe(200);
    expect(res.body.reports).toMatchObject({ open: 1, urgent: 1 });
    expect(res.body.users.total).toBeGreaterThan(0);
    expect(res.body.premium.active).toBe(0);
  });

  it('finds people by username or email and shows their record', async () => {
    const search = await h.request('GET', '/admin/users?q=off_oscar', { token: moderator.token });
    expect(search.body.data[0]).toMatchObject({ id: offender.id, username: 'off_oscar' });

    const detail = await h.request('GET', `/admin/users/${offender.id}`, {
      token: moderator.token,
    });
    expect(detail.body).toMatchObject({
      id: offender.id,
      username: 'off_oscar',
      premiumStatus: 'FREE',
      status: 'active',
    });
    expect(detail.body.email).toContain('@');
  });
});
