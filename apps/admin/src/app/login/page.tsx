'use client';

import { ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Field, Input, Logo } from '@morphcall/ui';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="flex w-full max-w-sm flex-col gap-6 p-8">
        <div className="flex flex-col gap-2">
          <Logo />
          <div className="flex items-center gap-2 text-body-sm text-muted">
            <ShieldCheck className="size-4 text-primary" aria-hidden /> Staff sign-in
          </div>
        </div>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
            setLoading(false);
            if (error) {
              setError('Those details don’t match a staff account.');
              return;
            }
            router.replace('/');
            router.refresh();
          }}
        >
          {error && (
            <p
              role="alert"
              className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-body-sm text-danger"
            >
              {error}
            </p>
          )}
          <Field id="email" label="Work email">
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
          <Button type="submit" loading={loading} disabled={!email || !password}>
            Sign in
          </Button>
        </form>
        <p className="text-caption text-subtle">
          Staff accounts require two-factor authentication in production. Access is granted by a
          super-admin and every action here is recorded.
        </p>
      </Card>
    </main>
  );
}
