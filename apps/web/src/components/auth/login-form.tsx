'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Field, Input } from '@morphcall/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Divider } from './auth-card';
import { GoogleButton } from './google-button';

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(
        error.message === 'Email not confirmed'
          ? 'Please confirm your email first — check your inbox for the link.'
          : 'That email and password don’t match an account.',
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton next={next} />
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
        <Field id="password" label="Password">
          {(a) => (
            <Input
              {...a}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <div className="-mt-2 flex justify-end">
          <Link href="/forgot-password" className="text-body-sm text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={loading} disabled={!email || !password}>
          Log in
        </Button>
      </form>
    </div>
  );
}
