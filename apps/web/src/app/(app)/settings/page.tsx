'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Me, SettingsUpdateInput, UserSettings } from '@morphcall/contracts';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  OptionCards,
  Textarea,
} from '@morphcall/ui';
import { AvatarPicker } from '@/components/profile/avatar-picker';
import { InterestPicker } from '@/components/profile/interest-picker';
import {
  CALL_OPTIONS,
  MESSAGE_OPTIONS,
  ONLINE_OPTIONS,
  PROFILE_OPTIONS,
} from '@/components/profile/privacy-options';
import { UsernameField, type UsernameState } from '@/components/profile/username-field';
import { errorMessage } from '@/lib/api';
import { env } from '@/lib/env';
import { useMe, useUpdateProfile, useUpdateSettings } from '@/lib/queries';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function SettingsPage() {
  const { data: me } = useMe();
  if (!me?.profile) return null;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-h1 font-bold">Settings</h1>
        <p className="text-body-sm text-muted">Manage your profile, privacy and account.</p>
      </div>
      <ProfileSection me={me} />
      <PrivacySection settings={me.settings} />
      <AppearanceSection settings={me.settings} />
      <AccountSection me={me} />
    </div>
  );
}

function ProfileSection({ me }: { me: Me }) {
  const profile = me.profile!;
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [interests, setInterests] = useState(profile.interests.map((i) => i.slug));
  const [uState, setUState] = useState<UsernameState>('idle');
  const update = useUpdateProfile();

  const dirty =
    username !== profile.username ||
    displayName !== profile.displayName ||
    bio !== (profile.bio ?? '') ||
    interests.slice().sort().join() !==
      profile.interests
        .map((i) => i.slug)
        .sort()
        .join();
  const usernameOk = username === profile.username || uState === 'available';

  return (
    <Card id="profile">
      <CardHeader>
        <div>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            This is what people see on your profile and in Discover.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <AvatarPicker userId={me.id} name={profile.displayName} src={profile.avatarUrl} />
        <form
          className="flex flex-col gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await update.mutateAsync({
                ...(username !== profile.username ? { username } : {}),
                displayName: displayName.trim(),
                bio: bio.trim(),
                interests,
              });
              toast.success('Profile saved.');
            } catch (err) {
              toast.error(errorMessage(err));
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <UsernameField
              value={username}
              onChange={setUsername}
              current={profile.username}
              onStateChange={setUState}
            />
            <Field id="display-name" label="Display name">
              {(a) => (
                <Input
                  {...a}
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field id="bio" label="Bio" hint={`${bio.length}/300`}>
            {(a) => (
              <Textarea
                {...a}
                maxLength={300}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            )}
          </Field>
          <div className="flex flex-col gap-2">
            <p className="text-body-sm font-medium">Interests</p>
            <InterestPicker value={interests} onChange={setInterests} />
          </div>
          <Button
            type="submit"
            className="self-end"
            loading={update.isPending}
            disabled={!dirty || !usernameOk || !displayName.trim()}
          >
            Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PrivacySection({ settings }: { settings: UserSettings }) {
  const update = useUpdateSettings();
  const save = (input: SettingsUpdateInput) =>
    update.mutate(input, {
      onSuccess: () => toast.success('Privacy updated.'),
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <Card id="privacy">
      <CardHeader>
        <div>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>Changes save automatically.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-body-sm font-semibold">Who can call me</legend>
          <OptionCards
            aria-label="Who can call me"
            value={settings.whoCanCall}
            onValueChange={(v) => save({ whoCanCall: v })}
            options={CALL_OPTIONS}
            disabled={update.isPending}
          />
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-body-sm font-semibold">Who can message me</legend>
          <OptionCards
            aria-label="Who can message me"
            value={settings.whoCanMessage}
            onValueChange={(v) => save({ whoCanMessage: v })}
            options={MESSAGE_OPTIONS}
            disabled={update.isPending}
          />
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-body-sm font-semibold">Online status</legend>
          <OptionCards
            aria-label="Online status visibility"
            value={settings.onlineVisibility}
            onValueChange={(v) => save({ onlineVisibility: v })}
            options={ONLINE_OPTIONS}
            disabled={update.isPending}
          />
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-body-sm font-semibold">Profile visibility</legend>
          <OptionCards
            aria-label="Profile visibility"
            value={settings.profileVisibility}
            onValueChange={(v) => save({ profileVisibility: v })}
            options={PROFILE_OPTIONS}
            disabled={update.isPending}
          />
        </fieldset>
      </CardContent>
    </Card>
  );
}

function AppearanceSection({ settings }: { settings: UserSettings }) {
  const { setTheme } = useTheme();
  const update = useUpdateSettings();
  const [theme, setLocal] = useState(settings.theme);
  useEffect(() => setLocal(settings.theme), [settings.theme]);

  return (
    <Card id="appearance">
      <CardHeader>
        <div>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Calls always use a dark screen so video looks its best.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <OptionCards
          aria-label="Theme"
          className="sm:grid-cols-3"
          value={theme}
          onValueChange={(v) => {
            setLocal(v);
            setTheme(v);
            update.mutate({ theme: v });
          }}
          options={[
            { value: 'system', label: 'System', description: 'Match your device' },
            { value: 'dark', label: 'Dark', description: 'Default' },
            { value: 'light', label: 'Light', description: 'Bright surfaces' },
          ]}
        />
      </CardContent>
    </Card>
  );
}

function AccountSection({ me }: { me: Me }) {
  const [sending, setSending] = useState(false);
  return (
    <Card id="account">
      <CardHeader>
        <div>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in as {me.email}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
          <div>
            <p className="text-body-sm font-medium">Password</p>
            <p className="text-caption text-muted">
              We’ll email you a secure link to set a new one.
            </p>
          </div>
          <Button
            variant="secondary"
            loading={sending}
            onClick={async () => {
              setSending(true);
              const { error } = await supabaseBrowser().auth.resetPasswordForEmail(me.email, {
                redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password`,
              });
              setSending(false);
              if (error) toast.error(error.message);
              else toast.success('Check your email for the link.');
            }}
          >
            Change password
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
          <div>
            <p className="text-body-sm font-medium">Plan</p>
            <p className="text-caption text-muted">
              {me.premium.hasPremiumAccess ? 'Premium' : 'Free'}
            </p>
          </div>
        </div>
        <p className="text-caption text-subtle">
          Data export and account deletion are coming soon. Until then, contact support and we’ll
          handle it for you.
        </p>
      </CardContent>
    </Card>
  );
}
