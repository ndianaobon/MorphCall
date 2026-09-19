import { Inject, Injectable } from '@nestjs/common';
import {
  type AccountBasicsInput,
  ageOn,
  type Me,
  MIN_AGE,
  ONBOARDING_STEPS,
  type PremiumStatus,
  type ProfileUpdateInput,
  type PublicProfile,
  type SettingsUpdateInput,
  type UserSettings,
} from '@morphcall/contracts';
import { sql } from 'drizzle-orm';
import { type AuthContext, isUnderAge } from '../auth/auth-context.js';
import { ApiException } from '../common/api-exception.js';
import { DB, type Db } from '../db/db.module.js';
import { ProfilesService } from '../social/profiles.service.js';
import { StorageUrls } from '../social/storage-urls.js';
import { AvatarStore } from './avatar-store.js';
import { dataRegionFor } from './regions.js';
import { RESERVED_USERNAMES } from './reserved-usernames.js';

const AVATAR_PATH = /^([0-9a-f-]{36})\/[a-z0-9-]{8,64}\.(jpg|jpeg|png|webp)$/;

interface OwnRow extends Record<string, unknown> {
  id: string;
  email: string;
  status: Me['status'];
  country_code: string | null;
  date_of_birth: string | null;
  is_creator: boolean;
  created_at: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  onboarding_step: number | null;
  onboarded_at: string | null;
  who_can_call: UserSettings['whoCanCall'];
  who_can_message: UserSettings['whoCanMessage'];
  online_visibility: UserSettings['onlineVisibility'];
  profile_visibility: UserSettings['profileVisibility'];
  theme: UserSettings['theme'];
  followers_count: number;
  following_count: number;
  premium_status: PremiumStatus;
  has_premium_access: boolean;
}

@Injectable()
export class MeService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly profiles: ProfilesService,
    private readonly urls: StorageUrls,
    private readonly avatars: AvatarStore,
  ) {}

  async getMe(userId: string): Promise<Me> {
    const rows = await this.db.execute<OwnRow>(sql`
      select u.id, u.email::text as email, u.status, u.country_code, u.date_of_birth, u.is_creator, u.created_at,
             p.username::text as username, p.display_name, p.bio, p.avatar_path, p.onboarding_step, p.onboarded_at,
             s.who_can_call, s.who_can_message, s.online_visibility, s.profile_visibility, s.theme,
             coalesce(st.followers_count, 0) as followers_count, coalesce(st.following_count, 0) as following_count,
             ps.status as premium_status, ps.has_premium_access
      from app.users u
      join app.user_settings s on s.user_id = u.id
      left join app.profiles p on p.user_id = u.id
      left join app.profile_stats st on st.user_id = u.id
      join app.user_premium_status ps on ps.user_id = u.id
      where u.id = ${userId}
    `);
    const row = rows[0];
    if (!row) throw new ApiException(401, 'unauthenticated', 'Account not found.');

    let profile: PublicProfile | null = null;
    if (row.username && row.display_name) {
      profile = {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        bio: row.bio,
        avatarUrl: this.urls.avatar(row.avatar_path),
        interests: await this.profiles.interestsOf(userId),
        stats: { followers: row.followers_count, following: row.following_count },
        isCreator: row.is_creator,
        online: true,
        restricted: false,
        relationship: { isSelf: true, following: false, followRequested: false, followsYou: false },
        joinedAt: new Date(row.created_at).toISOString(),
      };
    }

    return {
      id: row.id,
      email: row.email,
      status: row.status,
      restriction:
        row.status !== 'active'
          ? 'account'
          : isUnderAge({ dateOfBirth: row.date_of_birth })
            ? 'age'
            : null,
      countryCode: row.country_code,
      hasDateOfBirth: row.date_of_birth !== null,
      onboardingStep:
        row.onboarding_step !== null ? (ONBOARDING_STEPS[row.onboarding_step] ?? null) : null,
      onboarded: row.onboarded_at !== null,
      profile,
      settings: {
        whoCanCall: row.who_can_call,
        whoCanMessage: row.who_can_message,
        onlineVisibility: row.online_visibility,
        profileVisibility: row.profile_visibility,
        theme: row.theme,
      },
      // Display only. Every Premium feature re-checks on the server (docs/05 §3).
      premium: { status: row.premium_status, hasPremiumAccess: row.has_premium_access },
    };
  }

  /** Onboarding step 1. Date of birth is set once; under-18 accounts are restricted (docs/05 §1). */
  async setBasics(auth: AuthContext, input: AccountBasicsInput): Promise<Me> {
    if (auth.dateOfBirth && auth.dateOfBirth !== input.dateOfBirth) {
      throw new ApiException(
        409,
        'conflict',
        'Your date of birth is already set. Contact support if it is wrong.',
      );
    }
    await this.db.execute(sql`
      update app.users
      set date_of_birth = ${input.dateOfBirth}, country_code = ${input.countryCode},
          data_region = ${dataRegionFor(input.countryCode)}
      where id = ${auth.userId}
    `);
    if (ageOn(new Date(`${input.dateOfBirth}T00:00:00Z`)) < MIN_AGE) {
      throw new ApiException(403, 'age_restricted', 'MorphCall is only available to adults 18+.');
    }
    return this.getMe(auth.userId);
  }

  async isUsernameAvailable(username: string, exceptUserId?: string): Promise<boolean> {
    if (RESERVED_USERNAMES.has(username)) return false;
    const rows = await this.db.execute<{ user_id: string }>(sql`
      select user_id from app.profiles where username = ${username} limit 1
    `);
    const owner = rows[0]?.user_id;
    return !owner || owner === exceptUserId;
  }

  async updateProfile(auth: AuthContext, input: ProfileUpdateInput): Promise<Me> {
    if (!auth.dateOfBirth) {
      throw new ApiException(400, 'validation_error', 'Add your date of birth and country first.');
    }
    if (input.username && !(await this.isUsernameAvailable(input.username, auth.userId))) {
      throw new ApiException(409, 'username_taken', 'That username is taken.');
    }

    try {
      await this.db.transaction(async (tx) => {
        const existing = await tx.execute<{ user_id: string }>(sql`
          select user_id from app.profiles where user_id = ${auth.userId} for update
        `);
        const step =
          input.onboardingStep !== undefined
            ? ONBOARDING_STEPS.indexOf(input.onboardingStep)
            : undefined;

        if (!existing[0]) {
          if (!input.username || !input.displayName) {
            throw new ApiException(
              400,
              'validation_error',
              'Choose a username and display name first.',
            );
          }
          await tx.execute(sql`
            insert into app.profiles (user_id, username, display_name, bio, onboarding_step)
            values (${auth.userId}, ${input.username}, ${input.displayName}, ${input.bio ?? null}, ${step ?? 0})
          `);
        } else {
          const sets = [
            input.username !== undefined ? sql`username = ${input.username}` : null,
            input.displayName !== undefined ? sql`display_name = ${input.displayName}` : null,
            input.bio !== undefined ? sql`bio = ${input.bio || null}` : null,
            step !== undefined ? sql`onboarding_step = greatest(onboarding_step, ${step})` : null,
          ].filter((s) => s !== null);
          if (sets.length > 0) {
            await tx.execute(
              sql`update app.profiles set ${sql.join(sets, sql`, `)} where user_id = ${auth.userId}`,
            );
          }
        }

        if (input.interests) {
          const slugs = [...new Set(input.interests)];
          const found = slugs.length
            ? await tx.execute<{ id: number }>(sql`
                select id from app.interests
                where is_active and slug in (${sql.join(
                  slugs.map((s) => sql`${s}`),
                  sql`, `,
                )})
              `)
            : [];
          if (found.length !== slugs.length) {
            throw new ApiException(400, 'validation_error', 'Unknown interest selected.');
          }
          await tx.execute(sql`delete from app.user_interests where user_id = ${auth.userId}`);
          for (const { id } of found) {
            await tx.execute(sql`
              insert into app.user_interests (user_id, interest_id) values (${auth.userId}, ${id})
            `);
          }
        }
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ApiException(409, 'username_taken', 'That username is taken.');
      }
      throw err;
    }
    return this.getMe(auth.userId);
  }

  async completeOnboarding(auth: AuthContext): Promise<Me> {
    const rows = await this.db.execute<{ user_id: string }>(sql`
      update app.profiles
      set onboarded_at = coalesce(onboarded_at, now()),
          onboarding_step = ${ONBOARDING_STEPS.length - 1}
      where user_id = ${auth.userId}
      returning user_id
    `);
    if (!rows[0] || !auth.dateOfBirth) {
      throw new ApiException(400, 'validation_error', 'Finish the earlier onboarding steps first.');
    }
    return this.getMe(auth.userId);
  }

  async updateSettings(userId: string, input: SettingsUpdateInput): Promise<Me> {
    const sets = [
      input.whoCanCall ? sql`who_can_call = ${input.whoCanCall}` : null,
      input.whoCanMessage ? sql`who_can_message = ${input.whoCanMessage}` : null,
      input.onlineVisibility ? sql`online_visibility = ${input.onlineVisibility}` : null,
      input.profileVisibility ? sql`profile_visibility = ${input.profileVisibility}` : null,
      input.theme ? sql`theme = ${input.theme}` : null,
    ].filter((s) => s !== null);
    await this.db.execute(sql`
      update app.user_settings set ${sql.join(sets, sql`, `)}, updated_at = now() where user_id = ${userId}
    `);
    return this.getMe(userId);
  }

  /** The browser uploads into avatars/<userId>/… (storage policy); we only accept our own folder. */
  async setAvatar(userId: string, path: string): Promise<Me> {
    const match = AVATAR_PATH.exec(path);
    if (!match || match[1] !== userId) {
      throw new ApiException(400, 'validation_error', 'Invalid avatar path.');
    }
    if (!(await this.avatars.exists(path))) {
      throw new ApiException(400, 'validation_error', 'Upload the image before saving it.');
    }
    const rows = await this.db.execute<{ user_id: string }>(sql`
      update app.profiles set avatar_path = ${path} where user_id = ${userId} returning user_id
    `);
    if (!rows[0]) throw new ApiException(400, 'validation_error', 'Create your profile first.');
    return this.getMe(userId);
  }

  async removeAvatar(userId: string): Promise<Me> {
    await this.db.execute(
      sql`update app.profiles set avatar_path = null where user_id = ${userId}`,
    );
    return this.getMe(userId);
  }
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}
