'use client';

import { ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@morphcall/ui';
import { supabaseBrowser } from '@/lib/supabase/client';

export function RestrictedScreen({ reason }: { reason: 'age' | 'account' }) {
  const router = useRouter();
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="flex max-w-md flex-col items-center gap-4 p-8 text-center">
        <ShieldAlert className="size-10 text-warning" aria-hidden />
        <h1 className="text-h2 font-bold">
          {reason === 'age' ? 'MorphCall is for adults' : 'Your account is restricted'}
        </h1>
        <p className="text-body-sm text-muted">
          {reason === 'age'
            ? 'You need to be 18 or older to use MorphCall. If you entered your date of birth by mistake, contact support.'
            : 'This account can’t use MorphCall right now. If you think this is a mistake, contact support.'}
        </p>
        <Button
          variant="secondary"
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
            router.replace('/');
            router.refresh();
          }}
        >
          Sign out
        </Button>
      </Card>
    </div>
  );
}
