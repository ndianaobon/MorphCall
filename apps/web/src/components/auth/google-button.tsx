'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@morphcall/ui';
import { env } from '@/lib/env';
import { supabaseBrowser } from '@/lib/supabase/client';
import { GoogleIcon } from './auth-card';

export function GoogleButton({
  next = '/home',
  label = 'Continue with Google',
}: {
  next?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        const { error } = await supabaseBrowser().auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) {
          setLoading(false);
          toast.error(
            error.message.toLowerCase().includes('provider')
              ? 'Google sign-in isn’t enabled yet. Use email for now.'
              : error.message,
          );
        }
      }}
    >
      {!loading && <GoogleIcon />}
      {label}
    </Button>
  );
}
