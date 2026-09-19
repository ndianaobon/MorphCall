/**
 * Drizzle mapping for the tables the API uses so far.
 * The SQL migrations in /supabase/migrations are the source of truth; keep this in step.
 */
import {
  boolean,
  char,
  date,
  integer,
  pgSchema,
  primaryKey,
  smallint,
  smallserial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const app = pgSchema('app');

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = app.table('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  status: text('status')
    .$type<'active' | 'suspended' | 'banned' | 'pending_deletion' | 'deleted'>()
    .notNull(),
  dateOfBirth: date('date_of_birth', { mode: 'string' }),
  countryCode: char('country_code', { length: 2 }),
  dataRegion: text('data_region').notNull(),
  isCreator: boolean('is_creator').notNull(),
  lastSeenAt: ts('last_seen_at'),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
  deletedAt: ts('deleted_at'),
});

export const profiles = app.table('profiles', {
  userId: uuid('user_id').primaryKey(),
  username: text('username').notNull(),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  avatarPath: text('avatar_path'),
  coverPath: text('cover_path'),
  onboardingStep: smallint('onboarding_step').notNull(),
  onboardedAt: ts('onboarded_at'),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
});

export const profileStats = app.table('profile_stats', {
  userId: uuid('user_id').primaryKey(),
  followersCount: integer('followers_count').notNull(),
  followingCount: integer('following_count').notNull(),
  friendsCount: integer('friends_count').notNull(),
  callsCount: integer('calls_count').notNull(),
  updatedAt: ts('updated_at').notNull(),
});

export const interests = app.table('interests', {
  id: smallserial('id').primaryKey(),
  slug: text('slug').notNull(),
  label: text('label').notNull(),
  isActive: boolean('is_active').notNull(),
});

export const userInterests = app.table(
  'user_interests',
  {
    userId: uuid('user_id').notNull(),
    interestId: smallint('interest_id').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.interestId] })],
);

export const userSettings = app.table('user_settings', {
  userId: uuid('user_id').primaryKey(),
  whoCanCall: text('who_can_call')
    .$type<'everyone' | 'followers' | 'friends' | 'nobody'>()
    .notNull(),
  whoCanMessage: text('who_can_message')
    .$type<'everyone' | 'followers' | 'friends' | 'nobody'>()
    .notNull(),
  onlineVisibility: text('online_visibility')
    .$type<'everyone' | 'followers' | 'friends' | 'nobody'>()
    .notNull(),
  profileVisibility: text('profile_visibility')
    .$type<'public' | 'followers' | 'private'>()
    .notNull(),
  theme: text('theme').$type<'system' | 'dark' | 'light'>().notNull(),
  updatedAt: ts('updated_at').notNull(),
});

export const follows = app.table(
  'follows',
  {
    followerId: uuid('follower_id').notNull(),
    followeeId: uuid('followee_id').notNull(),
    status: text('status').$type<'active' | 'requested'>().notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] })],
);

export const blocks = app.table(
  'blocks',
  {
    blockerId: uuid('blocker_id').notNull(),
    blockedId: uuid('blocked_id').notNull(),
    reason: text('reason'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

export const notifications = app.table('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  type: text('type').notNull(),
  actorId: uuid('actor_id'),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  readAt: ts('read_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

/** View: provider-independent Premium status (docs/08 §4). */
export const userPremiumStatus = app
  .view('user_premium_status', {
    userId: uuid('user_id').notNull(),
    status: text('status').notNull(),
    hasPremiumAccess: boolean('has_premium_access').notNull(),
  })
  .existing();
