import { z } from 'zod';
import { paginationQuery } from './common.js';

export const CALL_STATUSES = [
  'ringing',
  'active',
  'ended',
  'missed',
  'declined',
  'canceled',
  'failed',
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_END_REASONS = [
  'hangup',
  'network',
  'timeout',
  'blocked',
  'moderation',
  'error',
] as const;
export type CallEndReason = (typeof CALL_END_REASONS)[number];

/** How long a call rings before it is marked missed (docs/02 §1.3). */
export const RING_TIMEOUT_SECONDS = 45;

export const startCallInput = z.object({ calleeId: z.uuid() });
export type StartCallInput = z.infer<typeof startCallInput>;

export interface CallPeer {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** What a client needs to join the LiveKit room. */
export interface CallCredentials {
  url: string;
  token: string;
  roomName: string;
  /** Seconds until the token expires; the client re-issues before then. */
  expiresIn: number;
}

export interface CallSummary {
  id: string;
  status: CallStatus;
  endReason: CallEndReason | null;
  direction: 'incoming' | 'outgoing';
  peer: CallPeer;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
}

export interface CallWithCredentials extends CallSummary {
  credentials: CallCredentials;
}

export const callQualityInput = z.object({
  rttMs: z.number().int().min(0).max(60_000).optional(),
  packetLoss: z.number().min(0).max(1).optional(),
  jitterMs: z.number().min(0).max(60_000).optional(),
  fps: z.number().min(0).max(240).optional(),
  reconnects: z.number().int().min(0).max(1000).optional(),
});
export type CallQualityInput = z.infer<typeof callQualityInput>;

export const callHistoryQuery = paginationQuery.extend({
  filter: z.enum(['all', 'missed', 'incoming', 'outgoing']).default('all'),
});
export type CallHistoryQuery = z.infer<typeof callHistoryQuery>;

/** Reasons someone can be unreachable — each maps to its own UI message. */
export const CALL_BLOCKED_CODES = [
  'user_unavailable',
  'user_busy',
  'privacy_restricted',
  'user_blocked',
] as const;

// ── Safety ────────────────────────────────────────────────────────────────────

export const REPORT_TARGET_TYPES = [
  'user',
  'message',
  'call',
  'livestream',
  'identity',
  'voice',
  'ai_session',
] as const;

export const REPORT_REASONS = [
  'harassment',
  'hate',
  'sexual_content',
  'minor_safety',
  'impersonation',
  'deepfake_misuse',
  'scam',
  'spam',
  'violence',
  'self_harm',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Urgent reasons jump the moderation queue (docs/05 §7.3). */
export const URGENT_REPORT_REASONS: ReportReason[] = ['minor_safety', 'violence', 'self_harm'];

export const createReportInput = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(2000).optional(),
});
export type CreateReportInput = z.infer<typeof createReportInput>;

export const createBlockInput = z.object({
  userId: z.uuid(),
  reason: z.string().trim().max(200).optional(),
});
export type CreateBlockInput = z.infer<typeof createBlockInput>;

export interface BlockedUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  blockedAt: string;
}

// ── Realtime events (docs/04 §3) ──────────────────────────────────────────────

export interface CallIncomingEvent {
  call: CallSummary;
  expiresAt: string;
}

export interface CallUpdatedEvent {
  callId: string;
  status: CallStatus;
  endReason: CallEndReason | null;
  durationSeconds: number | null;
}

export const REALTIME_EVENTS = {
  callIncoming: 'call.incoming',
  callUpdated: 'call.updated',
  presenceHeartbeat: 'presence.heartbeat',
} as const;
