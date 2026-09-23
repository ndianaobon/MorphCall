import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  type CallEndReason,
  type CallHistoryQuery,
  type CallQualityInput,
  type CallStatus,
  type CallSummary,
  type CallWithCredentials,
  type Paginated,
  REALTIME_EVENTS,
  RING_TIMEOUT_SECONDS,
} from '@morphcall/contracts';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { ApiException } from '../common/api-exception.js';
import { decodeCursor, encodeCursor } from '../common/cursor.js';
import { DB, type Db } from '../db/db.module.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { RelationshipPolicy } from '../social/relationship.policy.js';
import { StorageUrls } from '../social/storage-urls.js';
import { LiveKitService, TOKEN_TTL_SECONDS, userIdFromIdentity } from './livekit.service.js';

interface CallRow extends Record<string, unknown> {
  id: string;
  status: CallStatus;
  end_reason: CallEndReason | null;
  caller_id: string;
  callee_id: string;
  room_id: string;
  livekit_room_name: string;
  ring_started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  peer_id: string;
  peer_username: string;
  peer_display_name: string;
  peer_avatar_path: string | null;
}

const LIVE_STATUSES = sql`('ringing', 'active')`;

/** Placeholder "viewer" for lookups the system makes on nobody's behalf (webhooks, sweeper). */
const SYSTEM_VIEWER = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class CallsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallsService.name);
  private sweeper: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly livekit: LiveKitService,
    private readonly policy: RelationshipPolicy,
    private readonly realtime: RealtimeService,
    private readonly urls: StorageUrls,
  ) {}

  onModuleInit() {
    // Ring timeouts survive restarts because they are derived from the DB, not from timers
    // (a Redis-backed delayed job replaces this when the API runs on more than one instance).
    this.sweeper = setInterval(() => void this.expireStaleRinging(), 5_000);
    this.sweeper.unref?.();
  }

  onModuleDestroy() {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  // ── Starting and answering ──────────────────────────────────────────────────

  async start(callerId: string, calleeId: string): Promise<CallWithCredentials> {
    if (callerId === calleeId) {
      throw new ApiException(400, 'validation_error', 'You can’t call yourself.');
    }
    const relation = await this.policy.relation(callerId, calleeId);
    if (relation.blocked) throw ApiException.notFound('This profile does not exist.');

    const rows = await this.db.execute<{
      user_id: string;
      display_name: string;
      who_can_call: 'everyone' | 'followers' | 'friends' | 'nobody';
    }>(sql`
      select u.id as user_id, p.display_name, s.who_can_call
      from app.users u
      join app.profiles p on p.user_id = u.id
      join app.user_settings s on s.user_id = u.id
      where u.id = ${calleeId} and u.status = 'active' and p.onboarded_at is not null
    `);
    const callee = rows[0];
    if (!callee) throw ApiException.notFound('This profile does not exist.');

    // "Who can call me" — the caller must satisfy the callee's setting (docs/05 §2).
    // `relation.following` = the caller follows the callee, which is what "followers" means here.
    // "friends" stays closed until mutual friends ship in Stage 8.
    const allowed =
      callee.who_can_call === 'everyone' ||
      (callee.who_can_call === 'followers' && relation.following);
    if (!allowed) {
      throw new ApiException(
        403,
        'privacy_restricted',
        callee.who_can_call === 'nobody'
          ? 'This person isn’t accepting calls.'
          : callee.who_can_call === 'friends'
            ? 'This person only accepts calls from friends.'
            : 'Follow this person before calling them.',
      );
    }

    for (const [userId, message] of [
      [calleeId, 'This person is on another call.'],
      [callerId, 'You’re already in a call.'],
    ] as const) {
      if (await this.isBusy(userId)) throw new ApiException(409, 'user_busy', message);
    }

    const roomName = `call_${randomUUID()}`;
    const created = await this.db.transaction(async (tx) => {
      const room = await tx.execute<{ id: string }>(sql`
        insert into app.video_rooms (livekit_room_name, type, status, max_participants, created_by)
        values (${roomName}, 'call', 'open', 2, ${callerId})
        returning id
      `);
      const roomId = room[0]!.id;
      const call = await tx.execute<{ id: string; ring_started_at: string }>(sql`
        insert into app.call_sessions (room_id, caller_id, type, status)
        values (${roomId}, ${callerId}, 'direct', 'ringing')
        returning id, ring_started_at
      `);
      const callId = call[0]!.id;
      await tx.execute(sql`
        insert into app.room_participants (room_id, call_session_id, user_id, role, livekit_identity, invite_status)
        values (${roomId}, ${callId}, ${callerId}, 'caller', ${'u:' + callerId}, 'accepted'),
               (${roomId}, ${callId}, ${calleeId}, 'callee', ${'u:' + calleeId}, 'invited')
      `);
      return { callId, roomId, ringStartedAt: call[0]!.ring_started_at };
    });

    const [summaryForCaller, summaryForCallee] = await Promise.all([
      this.summary(created.callId, callerId),
      this.summary(created.callId, calleeId),
    ]);

    this.realtime.emitToUser(calleeId, REALTIME_EVENTS.callIncoming, {
      call: summaryForCallee,
      expiresAt: new Date(
        new Date(created.ringStartedAt).getTime() + RING_TIMEOUT_SECONDS * 1000,
      ).toISOString(),
    });

    return {
      ...summaryForCaller,
      credentials: await this.credentials(roomName, callerId),
    };
  }

  async accept(callId: string, userId: string): Promise<CallWithCredentials> {
    const call = await this.requireParticipant(callId, userId);
    if (call.callee_id !== userId) {
      throw new ApiException(403, 'validation_error', 'Only the person being called can accept.');
    }
    if (call.status !== 'ringing') {
      throw new ApiException(409, 'call_not_ringing', 'This call is no longer ringing.');
    }

    await this.db.execute(sql`
      update app.call_sessions set status = 'active', answered_at = now() where id = ${callId}
    `);
    await this.db.execute(sql`
      update app.room_participants set invite_status = 'accepted'
      where call_session_id = ${callId} and user_id = ${userId}
    `);
    await this.notifyUpdate(callId, [call.caller_id, call.callee_id]);
    return {
      ...(await this.summary(callId, userId)),
      credentials: await this.credentials(call.livekit_room_name, userId),
    };
  }

  async decline(callId: string, userId: string): Promise<CallSummary> {
    const call = await this.requireParticipant(callId, userId);
    if (call.callee_id !== userId) {
      throw new ApiException(403, 'validation_error', 'Only the person being called can decline.');
    }
    return this.finish(call, 'declined', null, userId);
  }

  async cancel(callId: string, userId: string): Promise<CallSummary> {
    const call = await this.requireParticipant(callId, userId);
    if (call.caller_id !== userId) {
      throw new ApiException(403, 'validation_error', 'Only the caller can cancel.');
    }
    return this.finish(call, 'canceled', null, userId);
  }

  async end(
    callId: string,
    userId: string,
    reason: CallEndReason = 'hangup',
  ): Promise<CallSummary> {
    const call = await this.requireParticipant(callId, userId);
    if (call.status === 'ringing') {
      return call.caller_id === userId
        ? this.finish(call, 'canceled', null, userId)
        : this.finish(call, 'declined', null, userId);
    }
    return this.finish(call, 'ended', reason, userId);
  }

  /** Re-issues a join token (token expiry, reconnect after a long pause). */
  async reissueToken(callId: string, userId: string) {
    const call = await this.requireParticipant(callId, userId);
    if (call.status !== 'active' && call.status !== 'ringing') {
      throw new ApiException(409, 'room_unavailable', 'This call has ended.');
    }
    return this.credentials(call.livekit_room_name, userId);
  }

  async saveQuality(callId: string, userId: string, stats: CallQualityInput) {
    await this.requireParticipant(callId, userId);
    await this.db.execute(sql`
      update app.call_sessions
      set quality_summary = coalesce(quality_summary, '{}'::jsonb) ||
          jsonb_build_object(${userId}::text, ${JSON.stringify(stats)}::jsonb)
      where id = ${callId}
    `);
    return { ok: true };
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  async summary(callId: string, viewerId: string): Promise<CallSummary> {
    const call = await this.requireParticipant(callId, viewerId);
    return this.toSummary(call, viewerId);
  }

  async history(userId: string, query: CallHistoryQuery): Promise<Paginated<CallSummary>> {
    const cursor = decodeCursor(query.cursor, 2);
    const filter =
      query.filter === 'missed'
        ? sql`and cs.status in ('missed', 'declined') and cs.caller_id <> ${userId}`
        : query.filter === 'incoming'
          ? sql`and cs.caller_id <> ${userId}`
          : query.filter === 'outgoing'
            ? sql`and cs.caller_id = ${userId}`
            : sql``;

    const rows = await this.db.execute<CallRow>(sql`
      ${this.callSelect(userId)}
      where exists (
        select 1 from app.room_participants rp
        where rp.call_session_id = cs.id and rp.user_id = ${userId}
      ) ${filter}
      ${cursor ? sql`and (cs.created_at, cs.id) < (${cursor[0]}::timestamptz, ${cursor[1]}::uuid)` : sql``}
      order by cs.created_at desc, cs.id desc
      limit ${query.limit + 1}
    `);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      data: page.map((r) => this.toSummary(r, userId)),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor([new Date(last.ring_started_at).toISOString(), last.id])
          : null,
    };
  }

  /** True while the user has a ringing or active call. */
  async isBusy(userId: string): Promise<boolean> {
    const rows = await this.db.execute<{ busy: boolean }>(sql`
      select exists (
        select 1 from app.call_sessions cs
        join app.room_participants rp on rp.call_session_id = cs.id
        where rp.user_id = ${userId} and cs.status in ${LIVE_STATUSES}
      ) as busy
    `);
    return rows[0]?.busy ?? false;
  }

  /** Used by blocking: kills any live call between two people (docs/05 §2). */
  async endLiveCallsBetween(a: string, b: string, reason: CallEndReason) {
    const rows = await this.db.execute<CallRow>(sql`
      ${this.callSelect(a)}
      where cs.status in ${LIVE_STATUSES}
        and exists (select 1 from app.room_participants rp where rp.call_session_id = cs.id and rp.user_id = ${a})
        and exists (select 1 from app.room_participants rp where rp.call_session_id = cs.id and rp.user_id = ${b})
    `);
    for (const call of rows) await this.finish(call, 'ended', reason, null);
  }

  // ── LiveKit webhooks (source of truth for join/leave, docs/02 §1.3) ──────────

  async handleWebhook(event: {
    event: string;
    room?: { name?: string };
    participant?: { identity?: string };
  }) {
    const roomName = event.room?.name;
    if (!roomName?.startsWith('call_')) return;
    const userId = event.participant?.identity
      ? userIdFromIdentity(event.participant.identity)
      : null;

    switch (event.event) {
      case 'participant_joined':
        if (userId) {
          await this.db.execute(sql`
            update app.room_participants rp set joined_at = coalesce(joined_at, now())
            from app.video_rooms vr
            where vr.id = rp.room_id and vr.livekit_room_name = ${roomName} and rp.user_id = ${userId}
          `);
        }
        break;
      case 'participant_left':
        if (userId) {
          await this.db.execute(sql`
            update app.room_participants rp set left_at = now()
            from app.video_rooms vr
            where vr.id = rp.room_id and vr.livekit_room_name = ${roomName} and rp.user_id = ${userId}
              and rp.left_at is null
          `);
          // In a 1-to-1 call, one participant leaving ends it.
          const call = await this.callByRoomName(roomName);
          if (call && call.status === 'active') await this.finish(call, 'ended', 'hangup', userId);
        }
        break;
      case 'room_finished': {
        const call = await this.callByRoomName(roomName);
        if (call && (call.status === 'active' || call.status === 'ringing')) {
          await this.finish(call, 'ended', 'hangup', null);
        }
        break;
      }
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private callSelect(viewerId: string) {
    return sql`
      select cs.id, cs.status, cs.end_reason, cs.caller_id, cs.room_id, cs.ring_started_at,
             cs.answered_at, cs.ended_at, cs.duration_seconds, vr.livekit_room_name,
             (select rp.user_id from app.room_participants rp
               where rp.call_session_id = cs.id and rp.user_id <> cs.caller_id limit 1) as callee_id,
             peer.user_id as peer_id, peer.username::text as peer_username,
             peer.display_name as peer_display_name, peer.avatar_path as peer_avatar_path
      from app.call_sessions cs
      join app.video_rooms vr on vr.id = cs.room_id
      left join lateral (
        select p.user_id, p.username, p.display_name, p.avatar_path
        from app.room_participants rp
        join app.profiles p on p.user_id = rp.user_id
        where rp.call_session_id = cs.id and rp.user_id <> ${viewerId}
        limit 1
      ) peer on true
    `;
  }

  private async requireParticipant(callId: string, userId: string): Promise<CallRow> {
    const rows = await this.db.execute<CallRow>(sql`
      ${this.callSelect(userId)}
      where cs.id = ${callId}
        and exists (
          select 1 from app.room_participants rp
          where rp.call_session_id = cs.id and rp.user_id = ${userId}
        )
    `);
    const call = rows[0];
    if (!call) throw ApiException.notFound('This call doesn’t exist.');
    return call;
  }

  private async callByRoomName(roomName: string): Promise<CallRow | null> {
    const rows = await this.db.execute<CallRow>(sql`
      ${this.callSelect(SYSTEM_VIEWER)}
      where vr.livekit_room_name = ${roomName}
    `);
    return rows[0] ?? null;
  }

  private async credentials(roomName: string, userId: string) {
    const rows = await this.db.execute<{ display_name: string }>(sql`
      select display_name from app.profiles where user_id = ${userId}
    `);
    return {
      url: this.livekit.url,
      token: await this.livekit.userToken({
        roomName,
        userId,
        displayName: rows[0]?.display_name ?? 'MorphCall user',
      }),
      roomName,
      expiresIn: TOKEN_TTL_SECONDS,
    };
  }

  /** Single exit point for every terminal state, so durations and cleanup always happen. */
  private async finish(
    call: CallRow,
    status: Extract<CallStatus, 'ended' | 'missed' | 'declined' | 'canceled' | 'failed'>,
    reason: CallEndReason | null,
    endedBy: string | null,
  ): Promise<CallSummary> {
    const updated = await this.db.execute<{ id: string }>(sql`
      update app.call_sessions
      set status = ${status},
          end_reason = ${reason},
          ended_by = ${endedBy},
          ended_at = now(),
          duration_seconds = case when answered_at is null then 0
                                  else greatest(0, extract(epoch from (now() - answered_at))::int) end
      where id = ${call.id} and status in ${LIVE_STATUSES}
      returning id
    `);

    if (updated[0]) {
      await this.db.execute(sql`
        update app.video_rooms set status = 'closed', closed_at = now() where id = ${call.room_id}
      `);
      await this.db.execute(sql`
        update app.room_participants set left_at = coalesce(left_at, now())
        where call_session_id = ${call.id} and left_at is null
      `);
      if (status === 'missed') {
        await this.db.execute(sql`
          update app.room_participants set invite_status = 'missed'
          where call_session_id = ${call.id} and invite_status = 'invited'
        `);
        await this.db.execute(sql`
          insert into app.notifications (user_id, type, actor_id, entity_type, entity_id)
          values (${call.callee_id}, 'call.missed', ${call.caller_id}, 'call', ${call.id})
        `);
      }
      await this.livekit.closeRoom(call.livekit_room_name);
      await this.notifyUpdate(call.id, [call.caller_id, call.callee_id]);
    }
    return this.toSummary(
      await this.requireParticipant(call.id, endedBy ?? call.caller_id),
      endedBy ?? call.caller_id,
    );
  }

  private async notifyUpdate(callId: string, userIds: (string | null)[]) {
    const rows = await this.db.execute<{
      status: CallStatus;
      end_reason: CallEndReason | null;
      duration_seconds: number | null;
    }>(
      sql`select status, end_reason, duration_seconds from app.call_sessions where id = ${callId}`,
    );
    const row = rows[0];
    if (!row) return;
    for (const userId of userIds) {
      if (!userId) continue;
      this.realtime.emitToUser(userId, REALTIME_EVENTS.callUpdated, {
        callId,
        status: row.status,
        endReason: row.end_reason,
        durationSeconds: row.duration_seconds,
      });
    }
  }

  private async expireStaleRinging() {
    try {
      const rows = await this.db.execute<CallRow>(sql`
        ${this.callSelect(SYSTEM_VIEWER)}
        where cs.status = 'ringing'
          and cs.ring_started_at < now() - make_interval(secs => ${RING_TIMEOUT_SECONDS})
      `);
      for (const call of rows) await this.finish(call, 'missed', 'timeout', null);
    } catch (err) {
      this.logger.warn(`Ring-timeout sweep failed: ${(err as Error).message}`);
    }
  }

  private toSummary(row: CallRow, viewerId: string): CallSummary {
    return {
      id: row.id,
      status: row.status,
      endReason: row.end_reason,
      direction: row.caller_id === viewerId ? 'outgoing' : 'incoming',
      peer: {
        id: row.peer_id,
        username: row.peer_username,
        displayName: row.peer_display_name,
        avatarUrl: this.urls.avatar(row.peer_avatar_path),
      },
      startedAt: new Date(row.ring_started_at).toISOString(),
      answeredAt: row.answered_at ? new Date(row.answered_at).toISOString() : null,
      endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
      durationSeconds: row.duration_seconds,
    };
  }
}
