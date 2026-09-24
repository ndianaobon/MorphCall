import { z } from 'zod';
import { paginationQuery } from './common.js';
import { REPORT_REASONS, REPORT_TARGET_TYPES } from './calls.js';

/** Staff roles, least to most privileged (docs/05 §2). */
export const STAFF_ROLES = ['support', 'moderator', 'admin', 'super_admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const REPORT_STATUSES = ['open', 'in_review', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const MODERATION_ACTIONS = [
  'warn',
  'suspend',
  'ban',
  'unban',
  'ai_access_revoked',
  'content_removed',
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export interface AdminMe {
  userId: string;
  email: string;
  role: StaffRole;
  /** Whether this session completed multi-factor authentication. */
  mfa: boolean;
}

export interface ReportedUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: 'active' | 'suspended' | 'banned' | 'pending_deletion' | 'deleted';
}

export interface ReportListItem {
  id: string;
  status: ReportStatus;
  priority: number;
  reason: (typeof REPORT_REASONS)[number];
  targetType: (typeof REPORT_TARGET_TYPES)[number];
  targetId: string;
  details: string | null;
  createdAt: string;
  reporter: ReportedUser | null;
  target: ReportedUser | null;
  assignedTo: string | null;
  /** How many other reports have been filed against this person. */
  priorReports: number;
}

export interface ReportDetail extends ReportListItem {
  resolutionNote: string | null;
  resolvedAt: string | null;
  /** Non-media context: for a call, who was in it and how long it lasted. */
  context: Record<string, unknown> | null;
  history: ModerationActionRecord[];
}

export interface ModerationActionRecord {
  id: string;
  action: ModerationAction;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
  revokedAt: string | null;
}

export interface AdminUserDetail extends ReportedUser {
  email: string;
  createdAt: string;
  lastSeenAt: string | null;
  countryCode: string | null;
  premiumStatus: string;
  followers: number;
  callsLast30Days: number;
  reportsAgainst: number;
  reportsFiled: number;
  history: ModerationActionRecord[];
}

export interface AdminOverview {
  users: {
    total: number;
    activeLast7Days: number;
    newLast7Days: number;
    suspended: number;
    banned: number;
  };
  premium: { active: number };
  calls: { live: number; last24Hours: number };
  reports: { open: number; urgent: number; resolvedLast7Days: number };
}

export const adminReportsQuery = paginationQuery.extend({
  status: z.enum([...REPORT_STATUSES, 'all']).default('open'),
  reason: z.enum(REPORT_REASONS).optional(),
});
export type AdminReportsQuery = z.infer<typeof adminReportsQuery>;

export const updateReportInput = z
  .object({
    status: z.enum(['in_review', 'resolved', 'dismissed']).optional(),
    assignToMe: z.boolean().optional(),
    resolutionNote: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.status !== undefined || v.assignToMe !== undefined, 'Nothing to update');
export type UpdateReportInput = z.infer<typeof updateReportInput>;

export const moderationActionInput = z
  .object({
    action: z.enum(MODERATION_ACTIONS),
    reason: z.string().trim().min(3).max(500),
    /** Suspensions only: when it lifts. Omit for an indefinite suspension. */
    expiresAt: z.iso.datetime().optional(),
    reportId: z.uuid().optional(),
  })
  .refine(
    (v) => v.action === 'suspend' || v.expiresAt === undefined,
    'Only suspensions can have an end date',
  );
export type ModerationActionInput = z.infer<typeof moderationActionInput>;

export const adminUsersQuery = paginationQuery.extend({
  q: z.string().trim().min(2).max(60).optional(),
  status: z.enum(['active', 'suspended', 'banned', 'all']).default('all'),
});

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
  admin: { id: string; email: string | null };
}
