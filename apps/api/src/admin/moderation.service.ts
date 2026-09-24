import { Inject, Injectable } from '@nestjs/common';
import type {
  AdminOverview,
  AdminUserDetail,
  ModerationActionInput,
  ModerationActionRecord,
  Paginated,
  ReportDetail,
  ReportListItem,
  ReportedUser,
  UpdateReportInput,
} from '@morphcall/contracts';
import { sql } from 'drizzle-orm';
import { CallsService } from '../calls/calls.service.js';
import { ApiException } from '../common/api-exception.js';
import { decodeCursor, encodeCursor } from '../common/cursor.js';
import { DB, type Db } from '../db/db.module.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { StorageUrls } from '../social/storage-urls.js';
import { AuditService } from './audit.service.js';
import type { StaffContext } from './staff.guard.js';

interface ReportRow extends Record<string, unknown> {
  id: string;
  status: ReportListItem['status'];
  priority: number;
  reason: ReportListItem['reason'];
  target_type: ReportListItem['targetType'];
  target_id: string;
  details: string | null;
  created_at: string;
  assigned_to: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  reporter_id: string | null;
  reporter_username: string | null;
  reporter_display_name: string | null;
  reporter_avatar: string | null;
  reporter_status: ReportedUser['status'] | null;
  target_user_id: string | null;
  target_username: string | null;
  target_display_name: string | null;
  target_avatar: string | null;
  target_status: ReportedUser['status'] | null;
  prior_reports: number;
}

@Injectable()
export class ModerationService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly calls: CallsService,
    private readonly realtime: RealtimeService,
    private readonly urls: StorageUrls,
  ) {}

  // ── Queue ───────────────────────────────────────────────────────────────────

  async listReports(query: {
    status: string;
    reason?: string;
    cursor?: string;
    limit: number;
  }): Promise<Paginated<ReportListItem>> {
    const cursor = decodeCursor(query.cursor, 3);
    const rows = await this.db.execute<ReportRow>(sql`
      ${this.reportSelect()}
      where true
        ${query.status === 'all' ? sql`` : sql`and r.status = ${query.status}`}
        ${query.reason ? sql`and r.reason = ${query.reason}` : sql``}
        ${
          cursor
            ? sql`and (r.priority, r.created_at, r.id) > (${cursor[0]}::smallint, ${cursor[1]}::timestamptz, ${cursor[2]}::uuid)`
            : sql``
        }
      order by r.priority asc, r.created_at asc, r.id asc
      limit ${query.limit + 1}
    `);
    const data = rows.slice(0, query.limit);
    const last = data.at(-1);
    return {
      data: data.map((r) => this.toListItem(r)),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor([last.priority, new Date(last.created_at).toISOString(), last.id])
          : null,
    };
  }

  async getReport(id: string): Promise<ReportDetail> {
    const rows = await this.db.execute<ReportRow>(sql`
      ${this.reportSelect()} where r.id = ${id}
    `);
    const row = rows[0];
    if (!row) throw ApiException.notFound('Report not found.');

    return {
      ...this.toListItem(row),
      resolutionNote: row.resolution_note,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
      context: await this.contextFor(row),
      history: row.target_user_id ? await this.historyFor(row.target_user_id) : [],
    };
  }

  async updateReport(
    staff: StaffContext,
    id: string,
    input: UpdateReportInput,
  ): Promise<ReportDetail> {
    const before = await this.getReport(id);
    const sets = [
      input.status ? sql`status = ${input.status}` : null,
      input.assignToMe ? sql`assigned_to = ${staff.userId}` : null,
      input.resolutionNote !== undefined ? sql`resolution_note = ${input.resolutionNote}` : null,
      input.status === 'resolved' || input.status === 'dismissed' ? sql`resolved_at = now()` : null,
    ].filter((s) => s !== null);

    await this.db.execute(sql`
      update app.reports set ${sql.join(sets, sql`, `)} where id = ${id}
    `);
    const after = await this.getReport(id);
    await this.audit.record({
      staff,
      action: `report.${input.status ?? 'assign'}`,
      targetType: 'report',
      targetId: id,
      before: { status: before.status, assignedTo: before.assignedTo },
      after: { status: after.status, assignedTo: after.assignedTo },
      reason: input.resolutionNote,
    });
    return after;
  }

  // ── Actions on people ───────────────────────────────────────────────────────

  /**
   * Applies a moderation decision: records it, updates the account, and (for suspensions
   * and bans) ends live calls and tells the user's open tabs immediately.
   */
  async actOnUser(
    staff: StaffContext,
    userId: string,
    input: ModerationActionInput,
  ): Promise<AdminUserDetail> {
    const rows = await this.db.execute<{ status: string }>(sql`
      select status from app.users where id = ${userId}
    `);
    const before = rows[0];
    if (!before) throw ApiException.notFound('This person does not exist.');
    if (userId === staff.userId) {
      throw new ApiException(400, 'validation_error', 'You can’t moderate your own account.');
    }

    const nextStatus =
      input.action === 'suspend'
        ? 'suspended'
        : input.action === 'ban'
          ? 'banned'
          : input.action === 'unban'
            ? 'active'
            : null;

    await this.db.transaction(async (tx) => {
      if (nextStatus) {
        await tx.execute(sql`update app.users set status = ${nextStatus} where id = ${userId}`);
      }
      if (input.action === 'unban') {
        await tx.execute(sql`
          update app.moderation_actions set revoked_at = now(), revoked_by = ${staff.userId}
          where target_user_id = ${userId} and action in ('suspend', 'ban') and revoked_at is null
        `);
      }
      await tx.execute(sql`
        insert into app.moderation_actions (report_id, target_user_id, action, reason, expires_at, created_by)
        values (${input.reportId ?? null}, ${userId}, ${input.action}, ${input.reason},
                ${input.expiresAt ?? null}::timestamptz, ${staff.userId})
      `);
      await tx.execute(sql`
        insert into app.notifications (user_id, type, entity_type, entity_id, data)
        values (${userId}, ${'moderation.' + input.action}, 'user', ${userId},
                ${JSON.stringify({ reason: input.reason, expiresAt: input.expiresAt ?? null })}::jsonb)
      `);
    });

    if (nextStatus === 'suspended' || nextStatus === 'banned') {
      await this.endEverythingFor(userId);
    }

    await this.audit.record({
      staff,
      action: `user.${input.action}`,
      targetType: 'user',
      targetId: userId,
      before: { status: before.status },
      after: { status: nextStatus ?? before.status },
      reason: input.reason,
    });
    return this.getUser(userId);
  }

  /** Ends live calls and tells the user's open tabs the account is restricted. */
  private async endEverythingFor(userId: string) {
    const peers = await this.db.execute<{ peer_id: string }>(sql`
      select distinct other.user_id as peer_id
      from app.call_sessions cs
      join app.room_participants mine on mine.call_session_id = cs.id and mine.user_id = ${userId}
      join app.room_participants other on other.call_session_id = cs.id and other.user_id <> ${userId}
      where cs.status in ('ringing', 'active')
    `);
    for (const { peer_id } of peers) {
      await this.calls.endLiveCallsBetween(userId, peer_id, 'moderation');
    }
    this.realtime.emitToUser(userId, 'account.restricted', { reason: 'moderation' });
  }

  // ── People ──────────────────────────────────────────────────────────────────

  async getUser(userId: string): Promise<AdminUserDetail> {
    const rows = await this.db.execute<{
      id: string;
      email: string;
      status: ReportedUser['status'];
      created_at: string;
      last_seen_at: string | null;
      country_code: string | null;
      username: string | null;
      display_name: string | null;
      avatar_path: string | null;
      premium_status: string;
      followers: number;
      calls_30d: number;
      reports_against: number;
      reports_filed: number;
    }>(sql`
      select u.id, u.email::text as email, u.status, u.created_at, u.last_seen_at, u.country_code,
             p.username::text as username, p.display_name, p.avatar_path,
             ps.status as premium_status,
             coalesce(st.followers_count, 0) as followers,
             (select count(*) from app.room_participants rp
                join app.call_sessions cs on cs.id = rp.call_session_id
               where rp.user_id = u.id and cs.created_at > now() - interval '30 days')::int as calls_30d,
             (select count(*) from app.reports r where r.target_user_id = u.id)::int as reports_against,
             (select count(*) from app.reports r where r.reporter_id = u.id)::int as reports_filed
      from app.users u
      left join app.profiles p on p.user_id = u.id
      left join app.profile_stats st on st.user_id = u.id
      join app.user_premium_status ps on ps.user_id = u.id
      where u.id = ${userId}
    `);
    const row = rows[0];
    if (!row) throw ApiException.notFound('This person does not exist.');

    return {
      id: row.id,
      email: row.email,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: this.urls.avatar(row.avatar_path),
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
      countryCode: row.country_code,
      premiumStatus: row.premium_status,
      followers: row.followers,
      callsLast30Days: row.calls_30d,
      reportsAgainst: row.reports_against,
      reportsFiled: row.reports_filed,
      history: await this.historyFor(userId),
    };
  }

  async searchUsers(query: { q?: string; status: string; limit: number }) {
    const rows = await this.db.execute<{
      id: string;
      email: string;
      status: ReportedUser['status'];
      username: string | null;
      display_name: string | null;
      avatar_path: string | null;
      reports_against: number;
    }>(sql`
      select u.id, u.email::text as email, u.status, p.username::text as username, p.display_name, p.avatar_path,
             (select count(*) from app.reports r where r.target_user_id = u.id)::int as reports_against
      from app.users u
      left join app.profiles p on p.user_id = u.id
      where true
        ${query.status === 'all' ? sql`` : sql`and u.status = ${query.status}`}
        ${
          query.q
            ? sql`and (u.email::text ilike ${'%' + query.q + '%'}
                    or p.username::text ilike ${'%' + query.q + '%'}
                    or lower(p.display_name) like ${'%' + query.q.toLowerCase() + '%'})`
            : sql``
        }
      order by u.created_at desc
      limit ${query.limit}
    `);
    return {
      data: rows.map((r) => ({
        id: r.id,
        email: r.email,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: this.urls.avatar(r.avatar_path),
        status: r.status,
        reportsAgainst: r.reports_against,
      })),
      nextCursor: null,
    };
  }

  // ── Overview ────────────────────────────────────────────────────────────────

  async overview(): Promise<AdminOverview> {
    const rows = await this.db.execute<Record<string, number>>(sql`
      select
        (select count(*) from app.users where deleted_at is null)::int as users_total,
        (select count(*) from app.users where last_seen_at > now() - interval '7 days')::int as users_active,
        (select count(*) from app.users where created_at > now() - interval '7 days')::int as users_new,
        (select count(*) from app.users where status = 'suspended')::int as users_suspended,
        (select count(*) from app.users where status = 'banned')::int as users_banned,
        (select count(*) from app.user_premium_status where has_premium_access)::int as premium_active,
        (select count(*) from app.call_sessions where status in ('ringing','active'))::int as calls_live,
        (select count(*) from app.call_sessions where created_at > now() - interval '24 hours')::int as calls_24h,
        (select count(*) from app.reports where status in ('open','in_review'))::int as reports_open,
        (select count(*) from app.reports where status in ('open','in_review') and priority = 1)::int as reports_urgent,
        (select count(*) from app.reports where resolved_at > now() - interval '7 days')::int as reports_resolved
    `);
    const r = rows[0]!;
    return {
      users: {
        total: r.users_total!,
        activeLast7Days: r.users_active!,
        newLast7Days: r.users_new!,
        suspended: r.users_suspended!,
        banned: r.users_banned!,
      },
      premium: { active: r.premium_active! },
      calls: { live: r.calls_live!, last24Hours: r.calls_24h! },
      reports: {
        open: r.reports_open!,
        urgent: r.reports_urgent!,
        resolvedLast7Days: r.reports_resolved!,
      },
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private reportSelect() {
    return sql`
      select r.id, r.status, r.priority, r.reason, r.target_type, r.target_id, r.details, r.created_at,
             r.assigned_to, r.resolution_note, r.resolved_at,
             reporter.id as reporter_id, rp.username::text as reporter_username,
             rp.display_name as reporter_display_name, rp.avatar_path as reporter_avatar,
             reporter.status as reporter_status,
             target.id as target_user_id, tp.username::text as target_username,
             tp.display_name as target_display_name, tp.avatar_path as target_avatar,
             target.status as target_status,
             (select count(*) from app.reports r2 where r2.target_user_id = r.target_user_id)::int as prior_reports
      from app.reports r
      left join app.users reporter on reporter.id = r.reporter_id
      left join app.profiles rp on rp.user_id = reporter.id
      left join app.users target on target.id = r.target_user_id
      left join app.profiles tp on tp.user_id = target.id
    `;
  }

  private toListItem(r: ReportRow): ReportListItem {
    const person = (
      id: string | null,
      username: string | null,
      displayName: string | null,
      avatar: string | null,
      status: ReportedUser['status'] | null,
    ): ReportedUser | null =>
      id
        ? {
            id,
            username,
            displayName,
            avatarUrl: this.urls.avatar(avatar),
            status: status ?? 'active',
          }
        : null;

    return {
      id: r.id,
      status: r.status,
      priority: r.priority,
      reason: r.reason,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details,
      createdAt: new Date(r.created_at).toISOString(),
      reporter: person(
        r.reporter_id,
        r.reporter_username,
        r.reporter_display_name,
        r.reporter_avatar,
        r.reporter_status,
      ),
      target: person(
        r.target_user_id,
        r.target_username,
        r.target_display_name,
        r.target_avatar,
        r.target_status,
      ),
      assignedTo: r.assigned_to,
      priorReports: r.prior_reports,
    };
  }

  private async historyFor(userId: string): Promise<ModerationActionRecord[]> {
    const rows = await this.db.execute<{
      id: string;
      action: ModerationActionRecord['action'];
      reason: string;
      expires_at: string | null;
      created_at: string;
      created_by: string;
      revoked_at: string | null;
    }>(sql`
      select id, action, reason, expires_at, created_at, created_by, revoked_at
      from app.moderation_actions
      where target_user_id = ${userId}
      order by created_at desc
      limit 50
    `);
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      reason: r.reason,
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(),
      createdBy: r.created_by,
      revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
    }));
  }

  /** Metadata only — moderators never see call media (docs/05 §5). */
  private async contextFor(r: ReportRow): Promise<Record<string, unknown> | null> {
    if (r.target_type !== 'call') return null;
    const rows = await this.db.execute<{
      status: string;
      started_at: string;
      duration_seconds: number | null;
      participants: string[];
    }>(sql`
      select cs.status, cs.ring_started_at as started_at, cs.duration_seconds,
             array(select coalesce(p.username::text, rp.user_id::text)
                     from app.room_participants rp
                     left join app.profiles p on p.user_id = rp.user_id
                    where rp.call_session_id = cs.id) as participants
      from app.call_sessions cs where cs.id = ${r.target_id}
    `);
    const call = rows[0];
    return call
      ? {
          kind: 'call',
          status: call.status,
          startedAt: new Date(call.started_at).toISOString(),
          durationSeconds: call.duration_seconds,
          participants: call.participants,
        }
      : null;
  }
}
