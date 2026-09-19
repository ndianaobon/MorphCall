import { Inject, Injectable } from '@nestjs/common';
import type { Interest, ProfileCard, PublicProfile } from '@morphcall/contracts';
import { sql } from 'drizzle-orm';
import { ApiException } from '../common/api-exception.js';
import { DB, type Db } from '../db/db.module.js';
import {
  type Audience,
  type ProfileVisibility,
  RelationshipPolicy,
} from './relationship.policy.js';
import { StorageUrls } from './storage-urls.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProfileRow extends Record<string, unknown> {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_path: string | null;
  is_creator: boolean;
  last_seen_at: string | null;
  created_at: string;
  profile_visibility: ProfileVisibility;
  online_visibility: Audience;
  followers_count: number;
  following_count: number;
}

/** Card row shape shared by discover, search and follower lists. */
export interface CardRow extends Record<string, unknown> {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_path: string | null;
  last_seen_at: string | null;
  profile_visibility: ProfileVisibility;
  online_visibility: Audience;
  interests: string[] | null;
  following: string | null;
}

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly policy: RelationshipPolicy,
    private readonly urls: StorageUrls,
  ) {}

  /** Resolve an id or (@)username to an active, onboarded user id — or 404. */
  async resolveHandle(handle: string): Promise<string> {
    const key = handle.startsWith('@') ? handle.slice(1) : handle;
    const byId = UUID_RE.test(key);
    const rows = await this.db.execute<{ id: string }>(sql`
      select u.id from app.users u
      join app.profiles p on p.user_id = u.id
      where ${byId ? sql`u.id = ${key}` : sql`p.username = ${key.toLowerCase()}`}
        and u.status = 'active' and p.onboarded_at is not null
      limit 1
    `);
    const id = rows[0]?.id;
    if (!id) throw ApiException.notFound('This profile does not exist.');
    return id;
  }

  async getProfile(targetId: string, viewerId: string | null): Promise<PublicProfile> {
    const isSelf = viewerId === targetId;
    const relation = viewerId && !isSelf ? await this.policy.relation(viewerId, targetId) : null;
    // Blocked either way → indistinguishable from "does not exist" (no enumeration).
    if (relation?.blocked) throw ApiException.notFound('This profile does not exist.');

    const rows = await this.db.execute<ProfileRow>(sql`
      select u.id, p.username::text as username, p.display_name, p.bio, p.avatar_path, u.is_creator,
             u.last_seen_at, u.created_at, s.profile_visibility, s.online_visibility,
             st.followers_count, st.following_count
      from app.users u
      join app.profiles p on p.user_id = u.id
      join app.user_settings s on s.user_id = u.id
      join app.profile_stats st on st.user_id = u.id
      where u.id = ${targetId} and u.status = 'active' and p.onboarded_at is not null
    `);
    const row = rows[0];
    if (!row) throw ApiException.notFound('This profile does not exist.');

    const following = relation?.following ?? false;
    const details = RelationshipPolicy.canSeeDetails(row.profile_visibility, isSelf, following);
    const interests = details ? await this.interestsOf(targetId) : [];

    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      bio: details ? row.bio : null,
      avatarUrl: this.urls.avatar(row.avatar_path),
      interests,
      stats: { followers: row.followers_count, following: row.following_count },
      isCreator: row.is_creator,
      online: RelationshipPolicy.canSeeOnline(row.online_visibility, isSelf, following)
        ? RelationshipPolicy.isOnline(row.last_seen_at)
        : null,
      restricted: !details,
      relationship: viewerId
        ? {
            isSelf,
            following,
            followRequested: relation?.followRequested ?? false,
            followsYou: relation?.followsYou ?? false,
          }
        : null,
      joinedAt: new Date(row.created_at).toISOString(),
    };
  }

  async interestsOf(userId: string): Promise<Interest[]> {
    return this.db.execute<Interest & Record<string, unknown>>(sql`
      select i.slug, i.label from app.user_interests ui
      join app.interests i on i.id = ui.interest_id
      where ui.user_id = ${userId}
      order by i.label
    `);
  }

  /** Can the viewer see this user's follower / following lists? */
  async assertDetailsVisible(targetId: string, viewerId: string): Promise<void> {
    if (targetId === viewerId) return;
    const relation = await this.policy.relation(viewerId, targetId);
    if (relation.blocked) throw ApiException.notFound('This profile does not exist.');
    const rows = await this.db.execute<{ profile_visibility: ProfileVisibility }>(sql`
      select profile_visibility from app.user_settings where user_id = ${targetId}
    `);
    const visibility = rows[0]?.profile_visibility ?? 'private';
    if (!RelationshipPolicy.canSeeDetails(visibility, false, relation.following)) {
      throw ApiException.notFound('This list is private.');
    }
  }

  toCard(row: CardRow): ProfileCard {
    const following = row.following === 'active';
    const details = RelationshipPolicy.canSeeDetails(row.profile_visibility, false, following);
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      bio: details ? row.bio : null,
      avatarUrl: this.urls.avatar(row.avatar_path),
      interests: details ? (row.interests ?? []) : [],
      online: RelationshipPolicy.canSeeOnline(row.online_visibility, false, following)
        ? RelationshipPolicy.isOnline(row.last_seen_at)
        : null,
      following,
      followRequested: row.following === 'requested',
    };
  }
}

/** SQL fragment: columns needed by `toCard`, relative to the viewer. Expects aliases u, p, s. */
export const cardColumns = (viewerId: string) => sql`
  u.id, p.username::text as username, p.display_name, p.bio, p.avatar_path, u.last_seen_at,
  s.profile_visibility, s.online_visibility,
  array(
    select i.slug from app.user_interests ui join app.interests i on i.id = ui.interest_id
    where ui.user_id = u.id order by i.slug
  ) as interests,
  (select f.status from app.follows f where f.follower_id = ${viewerId} and f.followee_id = u.id) as following
`;

/** SQL fragment: exclude users blocked by or blocking the viewer. Expects alias u. */
export const notBlocked = (viewerId: string) => sql`
  not exists (
    select 1 from app.blocks b
    where (b.blocker_id = ${viewerId} and b.blocked_id = u.id)
       or (b.blocker_id = u.id and b.blocked_id = ${viewerId})
  )
`;
