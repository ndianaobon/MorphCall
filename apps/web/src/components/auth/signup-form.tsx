'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Field, Input } from '@morphcall/ui';
import { env } from '@/lib/env';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Divider } from './auth-card';
import { GoogleButton } from './google-button';
import { NewPasswordField } from './password-input';
import { passwordOk } from './password-rules';

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabaseBrowser().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=/onboarding` },
    });
    setLoading(false);
    if (error) {
      setError(
        error.status === 429
          ? 'Too many sign-up attempts. Please wait a minute and try again.'
          : error.message,
      );
      return;
    }
    if (data.session) {
      // Email confirmation disabled for this environment: go straight to onboarding.
      router.replace('/onboarding');
      router.refresh();
    } else {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton next="/onboarding" label="Sign up with Google" />
      <Divider label="or with email" />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error && (
          <p
            role="alert"
            className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-body-sm text-danger"
          >
            {error}
          </p>
        )}
        <Field id="email" label="Email">
          {(a) => (
            <Input
              {...a}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <NewPasswordField value={password} onChange={setPassword} />
        <label className="flex items-start gap-2 text-body-sm text-muted">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-[var(--primary)]"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>I’m 18 or older and agree to the Terms of Service and Privacy Policy.</span>
        </label>
        <Button
          type="submit"
          loading={loading}
          disabled={!email || !passwordOk(password) || !agreed}
        >
          Create account
        </Button>
      </form>
    </div>
  );
}
