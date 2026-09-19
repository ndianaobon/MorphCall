import { Inject, Injectable } from '@nestjs/common';
import type { DiscoverQuery, Paginated, PaginationQuery, ProfileCard } from '@morphcall/contracts';
import { sql } from 'drizzle-orm';
import { decodeCursor, encodeCursor } from '../common/cursor.js';
import { DB, type Db } from '../db/db.module.js';
import { type CardRow, cardColumns, notBlocked, ProfilesService } from './profiles.service.js';
import { ONLINE_WINDOW_SECONDS } from './relationship.policy.js';

type ScoredRow = CardRow & { score: number; sort_at: string };
type ListRow = CardRow & { sort_at: string };

/** Only active, onboarded accounts are ever listed. Expects aliases u, p. */
const listable = sql`u.status = 'active' and p.onboarded_at is not null`;

@Injectable()
export class DiscoverService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly profiles: ProfilesService,
  ) {}

  /** Recommended people: shared interests first, then newest. Keyset-paginated. */
  async discover(viewerId: string, q: DiscoverQuery): Promise<Paginated<ProfileCard>> {
    const cursor = decodeCursor(q.cursor, 3);
    const nameFilter = q.q
      ? sql`and (strpos(lower(p.display_name), lower(${q.q})) > 0 or strpos(p.username::text, lower(${q.q})) > 0)`
      : sql``;
    const interestFilter =
      q.interests.length > 0
        ? sql`and exists (
            select 1 from app.user_interests ui join app.interests i on i.id = ui.interest_id
            where ui.user_id = u.id and i.slug in (${sql.join(
              q.interests.map((s) => sql`${s}`),
              sql`, `,
            )}))`
        : sql``;
    const onlineFilter = q.online
      ? sql`and u.last_seen_at > now() - make_interval(secs => ${ONLINE_WINDOW_SECONDS})
            and (s.online_visibility = 'everyone' or (s.online_visibility = 'followers' and exists (
              select 1 from app.follows f
              where f.follower_id = ${viewerId} and f.followee_id = u.id and f.status = 'active')))`
      : sql``;

    const rows = await this.db.execute<ScoredRow>(sql`
      with mine as (select interest_id from app.user_interests where user_id = ${viewerId}),
      candidates as (
        select ${cardColumns(viewerId)},
               p.created_at as sort_at,
               (select count(*) from app.user_interests ui
                 where ui.user_id = u.id and ui.interest_id in (select interest_id from mine))::int as score
        from app.users u
        join app.profiles p on p.user_id = u.id
        join app.user_settings s on s.user_id = u.id
        where ${listable} and u.id <> ${viewerId} and ${notBlocked(viewerId)}
          ${nameFilter} ${interestFilter} ${onlineFilter}
      )
      select * from candidates
      ${cursor ? sql`where (score, sort_at, id) < (${cursor[0]}::int, ${cursor[1]}::timestamptz, ${cursor[2]}::uuid)` : sql``}
      order by score desc, sort_at desc, id desc
      limit ${q.limit + 1}
    `);

    const page = rows.slice(0, q.limit);
    const last = page.at(-1);
    return {
      data: page.map((r) => this.profiles.toCard(r)),
      nextCursor:
        rows.length > q.limit && last
          ? encodeCursor([last.score, new Date(last.sort_at).toISOString(), last.id])
          : null,
    };
  }

  /** Name/username search, best matches first (top results only). */
  async search(viewerId: string, term: string, limit: number): Promise<Paginated<ProfileCard>> {
    const rows = await this.db.execute<CardRow>(sql`
      select ${cardColumns(viewerId)}
      from app.users u
      join app.profiles p on p.user_id = u.id
      join app.user_settings s on s.user_id = u.id
      where ${listable} and u.id <> ${viewerId} and ${notBlocked(viewerId)}
        and (strpos(p.username::text, lower(${term})) > 0
             or strpos(lower(p.display_name), lower(${term})) > 0
             or extensions.similarity(p.username::text, lower(${term})) > 0.3
             or extensions.similarity(lower(p.display_name), lower(${term})) > 0.3)
      order by greatest(extensions.similarity(p.username::text, lower(${term})),
                        extensions.similarity(lower(p.display_name), lower(${term}))) desc, u.id
      limit ${limit}
    `);
    return { data: rows.map((r) => this.profiles.toCard(r)), nextCursor: null };
  }

  /** Followers or following of `targetId`, newest first, as seen by `viewerId`. */
  async connections(
    viewerId: string,
    targetId: string,
    direction: 'followers' | 'following',
    page: PaginationQuery,
  ): Promise<Paginated<ProfileCard>> {
    await this.profiles.assertDetailsVisible(targetId, viewerId);
    const cursor = decodeCursor(page.cursor, 2);
    const join =
      direction === 'followers'
        ? sql`f.follower_id = u.id and f.followee_id = ${targetId}`
        : sql`f.followee_id = u.id and f.follower_id = ${targetId}`;

    const rows = await this.db.execute<ListRow>(sql`
      select ${cardColumns(viewerId)}, f.created_at as sort_at
      from app.follows f
      join app.users u on ${join}
      join app.profiles p on p.user_id = u.id
      join app.user_settings s on s.user_id = u.id
      where f.status = 'active' and ${listable} and ${notBlocked(viewerId)}
        ${cursor ? sql`and (f.created_at, u.id) < (${cursor[0]}::timestamptz, ${cursor[1]}::uuid)` : sql``}
      order by f.created_at desc, u.id desc
      limit ${page.limit + 1}
    `);
    const data = rows.slice(0, page.limit);
    const last = data.at(-1);
    return {
      data: data.map((r) => this.profiles.toCard(r)),
      nextCursor:
        rows.length > page.limit && last
          ? encodeCursor([new Date(last.sort_at).toISOString(), last.id])
          : null,
    };
  }

  /** Incoming follow requests (private profiles). */
  async followRequests(viewerId: string, page: PaginationQuery): Promise<Paginated<ProfileCard>> {
    const cursor = decodeCursor(page.cursor, 2);
    const rows = await this.db.execute<ListRow>(sql`
      select ${cardColumns(viewerId)}, f.created_at as sort_at
      from app.follows f
      join app.users u on u.id = f.follower_id
      join app.profiles p on p.user_id = u.id
      join app.user_settings s on s.user_id = u.id
      where f.followee_id = ${viewerId} and f.status = 'requested' and ${listable} and ${notBlocked(viewerId)}
        ${cursor ? sql`and (f.created_at, u.id) < (${cursor[0]}::timestamptz, ${cursor[1]}::uuid)` : sql``}
      order by f.created_at desc, u.id desc
      limit ${page.limit + 1}
    `);
    const data = rows.slice(0, page.limit);
    const last = data.at(-1);
    return {
      data: data.map((r) => this.profiles.toCard(r)),
      nextCursor:
        rows.length > page.limit && last
          ? encodeCursor([new Date(last.sort_at).toISOString(), last.id])
          : null,
    };
  }
}
