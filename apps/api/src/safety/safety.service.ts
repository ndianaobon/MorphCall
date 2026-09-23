import { Inject, Injectable } from '@nestjs/common';
import {
  type BlockedUser,
  type CreateBlockInput,
  type CreateReportInput,
  URGENT_REPORT_REASONS,
} from '@morphcall/contracts';
import { sql } from 'drizzle-orm';
import { ApiException } from '../common/api-exception.js';
import { CallsService } from '../calls/calls.service.js';
import { DB, type Db } from '../db/db.module.js';
import { StorageUrls } from '../social/storage-urls.js';

@Injectable()
export class SafetyService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly calls: CallsService,
    private readonly urls: StorageUrls,
  ) {}

  /**
   * Blocking is immediate and total: it drops follows both ways, ends any live call between
   * the two, and hides each user from the other everywhere (docs/05 §2).
   */
  async block(userId: string, input: CreateBlockInput) {
    if (userId === input.userId) {
      throw new ApiException(400, 'validation_error', 'You can’t block yourself.');
    }
    const exists = await this.db.execute<{ id: string }>(sql`
      select id from app.users where id = ${input.userId} and status <> 'deleted'
    `);
    if (!exists[0]) throw ApiException.notFound('This profile does not exist.');

    await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        insert into app.blocks (blocker_id, blocked_id, reason)
        values (${userId}, ${input.userId}, ${input.reason ?? null})
        on conflict (blocker_id, blocked_id) do nothing
      `);
      const removed = await tx.execute<{
        follower_id: string;
        followee_id: string;
        status: string;
      }>(sql`
        delete from app.follows
        where (follower_id = ${userId} and followee_id = ${input.userId})
           or (follower_id = ${input.userId} and followee_id = ${userId})
        returning follower_id, followee_id, status
      `);
      for (const row of removed.filter((r) => r.status === 'active')) {
        await tx.execute(sql`
          update app.profile_stats set following_count = greatest(following_count - 1, 0)
          where user_id = ${row.follower_id}
        `);
        await tx.execute(sql`
          update app.profile_stats set followers_count = greatest(followers_count - 1, 0)
          where user_id = ${row.followee_id}
        `);
      }
    });

    await this.calls.endLiveCallsBetween(userId, input.userId, 'blocked');
    return { blocked: true };
  }

  async unblock(userId: string, blockedId: string) {
    await this.db.execute(sql`
      delete from app.blocks where blocker_id = ${userId} and blocked_id = ${blockedId}
    `);
    return { blocked: false };
  }

  async listBlocked(userId: string): Promise<BlockedUser[]> {
    const rows = await this.db.execute<{
      id: string;
      username: string;
      display_name: string;
      avatar_path: string | null;
      created_at: string;
    }>(sql`
      select u.id, p.username::text as username, p.display_name, p.avatar_path, b.created_at
      from app.blocks b
      join app.users u on u.id = b.blocked_id
      left join app.profiles p on p.user_id = u.id
      where b.blocker_id = ${userId}
      order by b.created_at desc
      limit 200
    `);
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: this.urls.avatar(r.avatar_path),
      blockedAt: new Date(r.created_at).toISOString(),
    }));
  }

  /** Reports are cheap to file and always land in the queue; moderators triage them. */
  async report(userId: string, input: CreateReportInput) {
    const targetUserId = await this.resolveTargetUser(input);
    if (targetUserId === userId) {
      throw new ApiException(400, 'validation_error', 'You can’t report yourself.');
    }
    const priority = URGENT_REPORT_REASONS.includes(input.reason) ? 1 : 3;
    const rows = await this.db.execute<{ id: string }>(sql`
      insert into app.reports (reporter_id, target_type, target_id, target_user_id, reason, details, priority, status)
      values (${userId}, ${input.targetType}, ${input.targetId}, ${targetUserId}, ${input.reason},
              ${input.details ?? null}, ${priority}, 'open')
      returning id
    `);
    return { id: rows[0]!.id, status: 'open' as const };
  }

  /** Attaches the account behind the reported thing, so moderators can act on the person. */
  private async resolveTargetUser(input: CreateReportInput): Promise<string | null> {
    if (input.targetType === 'user') {
      const rows = await this.db.execute<{ id: string }>(sql`
        select id from app.users where id = ${input.targetId}
      `);
      if (!rows[0]) throw ApiException.notFound('This profile does not exist.');
      return rows[0].id;
    }
    if (input.targetType === 'call') {
      const rows = await this.db.execute<{ caller_id: string }>(sql`
        select caller_id from app.call_sessions where id = ${input.targetId}
      `);
      return rows[0]?.caller_id ?? null;
    }
    return null;
  }
}
