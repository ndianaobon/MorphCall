'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Field, Input } from '@morphcall/ui';
import { AuthCard } from '@/components/auth/auth-card';
import { env } from '@/lib/env';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, {
      redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    // Same message whether or not the account exists (no account enumeration).
    if (error && error.status === 429) {
      setError('Too many requests. Please wait a minute and try again.');
      return;
    }
    setSent(true);
  }

  return (
    <AuthCard
      title="Reset your password"
      description={
        sent
          ? 'If an account exists for that email, a reset link is on its way.'
          : 'Enter your account email and we’ll send you a reset link.'
      }
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      }
    >
      {!sent && (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error && (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}
          <Field id="email" label="Email">
            {(a) => (
              <Input
                {...a}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" loading={loading} disabled={!email}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
