import { z } from 'zod';

export const USERNAME_REGEX = /^[a-z0-9_.]{3,24}$/;
export const MIN_AGE = 18;
export const ONBOARDING_STEPS = [
  'welcome',
  'username',
  'profile',
  'photo',
  'interests',
  'privacy',
  'devices',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_REGEX, '3–24 characters: lowercase letters, numbers, "_" or "."');

export const displayNameSchema = z.string().trim().min(1).max(50);
export const bioSchema = z.string().trim().max(300);
export const countryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2 country code');

/** Whole years between `dob` and `now` (UTC dates). */
export function ageOn(dob: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export const dateOfBirthSchema = z.iso.date().refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return d.getUTCFullYear() >= 1900 && d.getTime() <= Date.now();
}, 'Enter a valid date of birth');

/** Step 1 — welcome: basic account facts. Age gate is enforced server-side. */
export const accountBasicsInput = z.object({
  dateOfBirth: dateOfBirthSchema,
  countryCode: countryCodeSchema,
});
export type AccountBasicsInput = z.infer<typeof accountBasicsInput>;

export const profileUpdateInput = z
  .object({
    username: usernameSchema,
    displayName: displayNameSchema,
    bio: bioSchema,
    interests: z.array(z.string().min(1).max(40)).max(10),
    onboardingStep: z.enum(ONBOARDING_STEPS),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type ProfileUpdateInput = z.infer<typeof profileUpdateInput>;

export const AUDIENCE = ['everyone', 'followers', 'friends', 'nobody'] as const;
export const PROFILE_VISIBILITY = ['public', 'followers', 'private'] as const;
export const THEMES = ['system', 'dark', 'light'] as const;

export const settingsUpdateInput = z
  .object({
    whoCanCall: z.enum(AUDIENCE),
    whoCanMessage: z.enum(AUDIENCE),
    onlineVisibility: z.enum(AUDIENCE),
    profileVisibility: z.enum(PROFILE_VISIBILITY),
    theme: z.enum(THEMES),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type SettingsUpdateInput = z.infer<typeof settingsUpdateInput>;

export interface UserSettings {
  whoCanCall: (typeof AUDIENCE)[number];
  whoCanMessage: (typeof AUDIENCE)[number];
  onlineVisibility: (typeof AUDIENCE)[number];
  profileVisibility: (typeof PROFILE_VISIBILITY)[number];
  theme: (typeof THEMES)[number];
}

export interface Interest {
  slug: string;
  label: string;
}

export interface ProfileStats {
  followers: number;
  following: number;
}

export type Relationship = {
  isSelf: boolean;
  following: boolean;
  followRequested: boolean;
  followsYou: boolean;
};

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  interests: Interest[];
  stats: ProfileStats;
  isCreator: boolean;
  /** null when the viewer is not allowed to see presence. */
  online: boolean | null;
  /** true when profile details are hidden from this viewer (private profile). */
  restricted: boolean;
  relationship: Relationship | null;
  joinedAt: string;
}

export type PremiumStatus =
  | 'FREE'
  | 'PENDING'
  | 'PREMIUM_ACTIVE'
  | 'PREMIUM_PAST_DUE'
  | 'PREMIUM_CANCELLED'
  | 'PREMIUM_EXPIRED';

export interface Me {
  id: string;
  email: string;
  status: 'active' | 'suspended' | 'banned' | 'pending_deletion' | 'deleted';
  /** Why the account can't use the app right now (null = unrestricted). */
  restriction: 'age' | 'account' | null;
  countryCode: string | null;
  hasDateOfBirth: boolean;
  onboardingStep: OnboardingStep | null;
  onboarded: boolean;
  profile: PublicProfile | null;
  settings: UserSettings;
  premium: { status: PremiumStatus; hasPremiumAccess: boolean };
}

export const avatarUploadInput = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
});
export type AvatarUploadInput = z.infer<typeof avatarUploadInput>;

export interface AvatarUploadTicket {
  path: string;
  token: string;
  signedUrl: string;
}

export const avatarConfirmInput = z.object({ path: z.string().min(1).max(300) });
