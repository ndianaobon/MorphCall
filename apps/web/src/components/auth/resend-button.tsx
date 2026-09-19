'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@morphcall/ui';
import { env } from '@/lib/env';
import { supabaseBrowser } from '@/lib/supabase/client';

export function ResendButton({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={loading}
      disabled={cooldown}
      onClick={async () => {
        setLoading(true);
        const { error } = await supabaseBrowser().auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=/onboarding` },
        });
        setLoading(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success('Sent! Check your inbox.');
        setCooldown(true);
        setTimeout(() => setCooldown(false), 60_000);
      }}
    >
      {cooldown ? 'Sent — you can resend in a minute' : 'Resend email'}
    </Button>
  );
}
