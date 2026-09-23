import { z } from 'zod';

/** Stable error codes shared by the API and the UI (docs/04-api.md §4). */
export const ERROR_CODES = [
  'validation_error',
  'unauthenticated',
  'account_restricted',
  'onboarding_required',
  'age_restricted',
  'not_found',
  'conflict',
  'user_blocked',
  'user_unavailable',
  'user_busy',
  'privacy_restricted',
  'call_not_ringing',
  'room_unavailable',
  'username_taken',
  'rate_limited',
  'upload_invalid_type',
  'upload_too_large',
  'premium_required',
  'premium_past_due',
  'server_error',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}

export const paginationQuery = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export const uuid = z.uuid();
