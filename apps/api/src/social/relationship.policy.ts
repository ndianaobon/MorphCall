import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';

export type Audience = 'everyone' | 'followers' | 'friends' | 'nobody';
export type ProfileVisibility = 'public' | 'followers' | 'private';

export interface Relation {
  blocked: boolean;
  following: boolean;
  followRequested: boolean;
  followsYou: boolean;
}

export const ONLINE_WINDOW_SECONDS = 120;

/**
 * The single place that answers "what may viewer V see/do about user U".
 * Every endpoint goes through here so no route can forget a block check (docs/05 §2).
 */
@Injectable()
export class RelationshipPolicy {
  constructor(@Inject(DB) private readonly db: Db) {}

  async relation(viewerId: string, targetId: string): Promise<Relation> {
    const rows = await this.db.execute<{
      blocked: boolean;
      following: string | null;
      follows_you: string | null;
    }>(sql`
      select
        exists (
          select 1 from app.blocks b
          where (b.blocker_id = ${viewerId} and b.blocked_id = ${targetId})
             or (b.blocker_id = ${targetId} and b.blocked_id = ${viewerId})
        ) as blocked,
        (select f.status from app.follows f where f.follower_id = ${viewerId} and f.followee_id = ${targetId}) as following,
        (select f.status from app.follows f where f.follower_id = ${targetId} and f.followee_id = ${viewerId}) as follows_you
    `);
    const r = rows[0];
    return {
      blocked: r?.blocked ?? false,
      following: r?.following === 'active',
      followRequested: r?.following === 'requested',
      followsYou: r?.follows_you === 'active',
    };
  }

  /** Full profile details (bio, interests, follower lists) visible to this viewer? */
  static canSeeDetails(visibility: ProfileVisibility, isSelf: boolean, following: boolean) {
    return isSelf || visibility === 'public' || following;
  }

  /** Presence visible to this viewer? Friends arrive in Stage 8, until then treated as "nobody". */
  static canSeeOnline(audience: Audience, isSelf: boolean, following: boolean) {
    if (isSelf || audience === 'everyone') return true;
    if (audience === 'followers') return following;
    return false;
  }

  static isOnline(lastSeenAt: Date | string | null, now = Date.now()) {
    if (!lastSeenAt) return false;
    return now - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_SECONDS * 1000;
  }
}
