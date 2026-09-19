'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { type Me, ONBOARDING_STEPS, type UserSettings } from '@morphcall/contracts';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Logo,
  OptionCards,
  Spinner,
  Textarea,
} from '@morphcall/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { countryOptions, guessCountry } from '@/lib/countries';
import {
  keys,
  useCompleteOnboarding,
  useMe,
  useSetBasics,
  useUpdateProfile,
  useUpdateSettings,
} from '@/lib/queries';
import { supabaseBrowser } from '@/lib/supabase/client';
import { AvatarPicker } from '../profile/avatar-picker';
import { InterestPicker } from '../profile/interest-picker';
import { CALL_OPTIONS, ONLINE_OPTIONS, PROFILE_OPTIONS } from '../profile/privacy-options';
import { UsernameField, type UsernameState } from '../profile/username-field';
import { RestrictedScreen } from '../restricted-screen';
import { DeviceCheck } from './device-check';

const TITLES = [
  {
    title: 'Welcome to MorphCall',
    description: 'First, a couple of quick details. MorphCall is for adults 18+.',
  },
  { title: 'Pick your username', description: 'This is how people find and mention you.' },
  {
    title: 'Tell people about you',
    description: 'A short bio helps people decide to connect. You can skip this.',
  },
  {
    title: 'Add a profile photo',
    description: 'Faces get more follows and calls. You can skip this.',
  },
  { title: 'What are you into?', description: 'We use these to recommend people. Pick a few.' },
  { title: 'Your privacy', description: 'You can change these any time in Settings.' },
  {
    title: 'Camera & microphone',
    description: 'Make sure everything works before your first call.',
  },
];

function initialStep(me: Me): number {
  if (!me.hasDateOfBirth) return 0;
  if (!me.profile) return 1;
  const i = me.onboardingStep ? ONBOARDING_STEPS.indexOf(me.onboardingStep) : 2;
  return Math.min(Math.max(i, 2), ONBOARDING_STEPS.length - 1);
}

export function OnboardingFlow() {
  const router = useRouter();
  const { data: me, error, isLoading, refetch } = useMe();
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (!me) return;
    if (me.onboarded) router.replace('/home');
    else setStep((s) => s ?? initialStep(me));
  }, [me, router]);

  if (error instanceof ApiError && error.code === 'unauthenticated') {
    router.replace('/login?next=/onboarding');
    return null;
  }
  if (me?.restriction) return <RestrictedScreen reason={me.restriction} />;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
        <Logo />
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
            router.replace('/');
            router.refresh();
          }}
        >
          Sign out
        </Button>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pb-16">
        {isLoading || step === null || !me ? (
          error ? (
            <ErrorState
              description={errorMessage(error)}
              requestId={error instanceof ApiError ? error.requestId : undefined}
              action={<Button onClick={() => refetch()}>Try again</Button>}
            />
          ) : (
            <div className="flex justify-center py-20">
              <Spinner label="Loading your profile" />
            </div>
          )
        ) : (
          <>
            <Progress step={step} />
            <Card className="flex flex-col gap-6 p-6 sm:p-8">
              <div className="flex flex-col gap-1">
                <h1 className="text-h2 font-bold">{TITLES[step]!.title}</h1>
                <p className="text-body-sm text-muted">{TITLES[step]!.description}</p>
              </div>
              <StepBody
                step={step}
                me={me}
                onNext={() => setStep(step + 1)}
                onDone={() => {
                  router.replace('/home');
                  router.refresh();
                }}
              />
            </Card>
            {step > 2 && (
              <Button variant="ghost" className="w-fit" onClick={() => setStep(step - 1)}>
                <ArrowLeft aria-hidden /> Back
              </Button>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  const total = ONBOARDING_STEPS.length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-muted">
        Step {step + 1} of {total}
      </p>
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step + 1}
        aria-label="Onboarding progress"
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-card-elevated'}`}
          />
        ))}
      </div>
    </div>
  );
}

function StepBody({
  step,
  me,
  onNext,
  onDone,
}: {
  step: number;
  me: Me;
  onNext: () => void;
  onDone: () => void;
}) {
  switch (step) {
    case 0:
      return <BasicsStep onNext={onNext} />;
    case 1:
      return <UsernameStep me={me} onNext={onNext} />;
    case 2:
      return <BioStep me={me} onNext={onNext} />;
    case 3:
      return <PhotoStep me={me} onNext={onNext} />;
    case 4:
      return <InterestsStep me={me} onNext={onNext} />;
    case 5:
      return <PrivacyStep me={me} onNext={onNext} />;
    default:
      return <DevicesStep onDone={onDone} />;
  }
}

function useAdvance(onNext: () => void) {
  const update = useUpdateProfile();
  return {
    pending: update.isPending,
    save: async (input: Parameters<typeof update.mutateAsync>[0]) => {
      try {
        await update.mutateAsync(input);
        onNext();
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
  };
}

function BasicsStep({ onNext }: { onNext: () => void }) {
  const countries = useMemo(() => countryOptions(), []);
  const [dob, setDob] = useState('');
  const [country, setCountry] = useState(() => guessCountry() ?? '');
  const [error, setError] = useState<string | null>(null);
  const setBasics = useSetBasics();
  const queryClient = useQueryClient();
  const maxDate = new Date().toISOString().slice(0, 10);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await setBasics.mutateAsync({ dateOfBirth: dob, countryCode: country });
          onNext();
        } catch (err) {
          // age_restricted refetches /me and the page switches to the restricted screen.
          if (err instanceof ApiError && err.code === 'age_restricted') {
            await queryClient.invalidateQueries({ queryKey: keys.me });
            return;
          }
          setError(errorMessage(err));
        }
      }}
    >
      <Field
        id="dob"
        label="Date of birth"
        hint="We never show this on your profile."
        error={error}
      >
        {(a) => (
          <Input
            {...a}
            type="date"
            required
            max={maxDate}
            min="1900-01-01"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
        )}
      </Field>
      <Field
        id="country"
        label="Country"
        hint="Used to keep your data in the right region and apply local rules."
      >
        {(a) => (
          <select
            {...a}
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="h-10 w-full rounded-sm border border-border-strong bg-surface px-3 text-body text-text focus-visible:border-primary"
          >
            <option value="" disabled>
              Select your country
            </option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Button type="submit" loading={setBasics.isPending} disabled={!dob || !country}>
        Continue
      </Button>
    </form>
  );
}

function UsernameStep({ me, onNext }: { me: Me; onNext: () => void }) {
  const [username, setUsername] = useState(me.profile?.username ?? '');
  const [displayName, setDisplayName] = useState(me.profile?.displayName ?? '');
  const [state, setState] = useState<UsernameState>('idle');
  const { save, pending } = useAdvance(onNext);
  const usernameOk =
    state === 'available' || (state === 'idle' && username === me.profile?.username);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ username, displayName: displayName.trim(), onboardingStep: 'profile' });
      }}
    >
      <UsernameField
        value={username}
        onChange={setUsername}
        current={me.profile?.username}
        onStateChange={setState}
      />
      <Field id="display-name" label="Display name" hint="Your name as people will see it.">
        {(a) => (
          <Input
            {...a}
            maxLength={50}
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" loading={pending} disabled={!usernameOk || !displayName.trim()}>
        Continue
      </Button>
    </form>
  );
}

function BioStep({ me, onNext }: { me: Me; onNext: () => void }) {
  const [bio, setBio] = useState(me.profile?.bio ?? '');
  const { save, pending } = useAdvance(onNext);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ bio: bio.trim(), onboardingStep: 'photo' });
      }}
    >
      <Field id="bio" label="Bio" hint={`${bio.length}/300`}>
        {(a) => (
          <Textarea
            {...a}
            maxLength={300}
            placeholder="Singer, night owl, always up for a chat about films…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        )}
      </Field>
      <StepActions pending={pending} skip={() => void save({ onboardingStep: 'photo' })} />
    </form>
  );
}

function PhotoStep({ me, onNext }: { me: Me; onNext: () => void }) {
  const { save, pending } = useAdvance(onNext);
  const profile = me.profile!;
  return (
    <div className="flex flex-col gap-6">
      <AvatarPicker userId={me.id} name={profile.displayName} src={profile.avatarUrl} />
      <Button loading={pending} onClick={() => void save({ onboardingStep: 'interests' })}>
        {profile.avatarUrl ? 'Continue' : 'Skip for now'}
      </Button>
    </div>
  );
}

function InterestsStep({ me, onNext }: { me: Me; onNext: () => void }) {
  const [interests, setInterests] = useState(me.profile?.interests.map((i) => i.slug) ?? []);
  const { save, pending } = useAdvance(onNext);
  return (
    <div className="flex flex-col gap-6">
      <InterestPicker value={interests} onChange={setInterests} />
      <StepActions
        pending={pending}
        onContinue={() => void save({ interests, onboardingStep: 'privacy' })}
        skip={() => void save({ onboardingStep: 'privacy' })}
      />
    </div>
  );
}

function PrivacyStep({ me, onNext }: { me: Me; onNext: () => void }) {
  const [settings, setSettings] = useState<UserSettings>(me.settings);
  const updateSettings = useUpdateSettings();
  const { save, pending } = useAdvance(onNext);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body-sm font-semibold">Who can call you?</legend>
        <OptionCards
          aria-label="Who can call you"
          value={settings.whoCanCall}
          onValueChange={(v) => setSettings({ ...settings, whoCanCall: v })}
          options={CALL_OPTIONS}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body-sm font-semibold">Who can see when you’re online?</legend>
        <OptionCards
          aria-label="Who can see when you are online"
          value={settings.onlineVisibility}
          onValueChange={(v) => setSettings({ ...settings, onlineVisibility: v })}
          options={ONLINE_OPTIONS}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body-sm font-semibold">Profile visibility</legend>
        <OptionCards
          aria-label="Profile visibility"
          value={settings.profileVisibility}
          onValueChange={(v) => setSettings({ ...settings, profileVisibility: v })}
          options={PROFILE_OPTIONS}
        />
      </fieldset>
      <Button
        loading={pending || updateSettings.isPending}
        onClick={async () => {
          try {
            await updateSettings.mutateAsync({
              whoCanCall: settings.whoCanCall,
              onlineVisibility: settings.onlineVisibility,
              profileVisibility: settings.profileVisibility,
            });
            await save({ onboardingStep: 'devices' });
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        Continue
      </Button>
    </div>
  );
}

function DevicesStep({ onDone }: { onDone: () => void }) {
  const complete = useCompleteOnboarding();
  const finish = async () => {
    try {
      await complete.mutateAsync();
      toast.success('You’re all set. Welcome to MorphCall!');
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <div className="flex flex-col gap-6">
      <DeviceCheck />
      <StepActions
        pending={complete.isPending}
        onContinue={finish}
        continueLabel="Finish"
        skip={finish}
        skipLabel="Do this later"
      />
    </div>
  );
}

function StepActions({
  pending,
  onContinue,
  skip,
  continueLabel = 'Continue',
  skipLabel = 'Skip',
}: {
  pending: boolean;
  onContinue?: () => void;
  skip: () => void;
  continueLabel?: string;
  skipLabel?: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="ghost" onClick={skip} disabled={pending}>
        {skipLabel}
      </Button>
      <Button type={onContinue ? 'button' : 'submit'} onClick={onContinue} loading={pending}>
        {continueLabel}
      </Button>
    </div>
  );
}
