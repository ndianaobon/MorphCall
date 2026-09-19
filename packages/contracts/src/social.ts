import { z } from 'zod';
import { paginationQuery } from './common.js';

export const discoverQuery = paginationQuery.extend({
  q: z.string().trim().min(2).max(50).optional(),
  interests: z
    .string()
    .max(400)
    .optional()
    .transform((s) => (s ? s.split(',').filter(Boolean).slice(0, 10) : [])),
  online: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
export type DiscoverQuery = z.infer<typeof discoverQuery>;

export const searchQuery = paginationQuery.extend({
  q: z.string().trim().min(2).max(50),
});

export interface ProfileCard {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  interests: string[];
  online: boolean | null;
  following: boolean;
  followRequested: boolean;
}

export interface FollowResult {
  status: 'active' | 'requested' | 'none';
}
