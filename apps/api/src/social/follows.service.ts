import { Inject, Injectable } from '@nestjs/common';
import type { FollowResult } from '@morphcall/contracts';
import { sql } from 'drizzle-orm';
import { ApiException } from '../common/api-exception.js';
import { DB, type Db } from '../db/db.module.js';
import { RelationshipPolicy } from './relationship.policy.js';

@Injectable()
export class FollowsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly policy: RelationshipPolicy,
  ) {}

  async follow(viewerId: string, targetId: string): Promise<FollowResult> {
    if (viewerId === targetId)
      throw new ApiException(400, 'validation_error', "You can't follow yourself.");
    const relation = await this.policy.relation(viewerId, targetId);
    if (relation.blocked) throw ApiException.notFound('This profile does not exist.');

    return this.db.transaction(async (tx) => {
      const target = await tx.execute<{ profile_visibility: string }>(sql`
        select s.profile_visibility from app.users u
        join app.profiles p on p.user_id = u.id
        join app.user_settings s on s.user_id = u.id
        where u.id = ${targetId} and u.status = 'active' and p.onboarded_at is not null
      `);
      const visibility = target[0]?.profile_visibility;
      if (!visibility) throw ApiException.notFound('This profile does not exist.');

      const status = visibility === 'private' ? 'requested' : 'active';
      const inserted = await tx.execute<{ status: 'active' | 'requested' }>(sql`
        insert into app.follows (follower_id, followee_id, status)
        values (${viewerId}, ${targetId}, ${status})
        on conflict (follower_id, followee_id) do nothing
        returning status
      `);
      const created = inserted[0];
      if (!created) {
        // Already following / already requested: idempotent.
        const existing = await tx.execute<{ status: 'active' | 'requested' }>(sql`
          select status from app.follows where follower_id = ${viewerId} and followee_id = ${targetId}
        `);
        return { status: existing[0]?.status ?? 'none' };
      }

      if (created.status === 'active') await adjustCounts(tx, viewerId, targetId, 1);
      await tx.execute(sql`
        insert into app.notifications (user_id, type, actor_id, entity_type, entity_id)
        values (${targetId}, ${created.status === 'active' ? 'follow.new' : 'follow.request'},
                ${viewerId}, 'user', ${viewerId})
      `);
      return { status: created.status };
    });
  }

  async unfollow(viewerId: string, targetId: string): Promise<FollowResult> {
    return this.db.transaction(async (tx) => {
      const deleted = await tx.execute<{ status: string }>(sql`
        delete from app.follows where follower_id = ${viewerId} and followee_id = ${targetId}
        returning status
      `);
      if (deleted[0]?.status === 'active') await adjustCounts(tx, viewerId, targetId, -1);
      return { status: 'none' };
    });
  }

  async acceptRequest(viewerId: string, followerId: string): Promise<FollowResult> {
    return this.db.transaction(async (tx) => {
      const updated = await tx.execute<{ follower_id: string }>(sql`
        update app.follows set status = 'active'
        where follower_id = ${followerId} and followee_id = ${viewerId} and status = 'requested'
        returning follower_id
      `);
      if (!updated[0]) throw ApiException.notFound('No pending request from this person.');
      await adjustCounts(tx, followerId, viewerId, 1);
      await tx.execute(sql`
        insert into app.notifications (user_id, type, actor_id, entity_type, entity_id)
        values (${followerId}, 'follow.accepted', ${viewerId}, 'user', ${viewerId})
      `);
      return { status: 'active' };
    });
  }

  async declineRequest(viewerId: string, followerId: string): Promise<FollowResult> {
    await this.db.execute(sql`
      delete from app.follows
      where follower_id = ${followerId} and followee_id = ${viewerId} and status = 'requested'
    `);
    return { status: 'none' };
  }
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Stage 1 keeps counters transactional; docs/03 §6 moves this to async jobs at scale. */
async function adjustCounts(tx: Tx, followerId: string, followeeId: string, delta: 1 | -1) {
  await tx.execute(sql`
    update app.profile_stats set following_count = greatest(following_count + ${delta}, 0), updated_at = now()
    where user_id = ${followerId}
  `);
  await tx.execute(sql`
    update app.profile_stats set followers_count = greatest(followers_count + ${delta}, 0), updated_at = now()
    where user_id = ${followeeId}
  `);
}
