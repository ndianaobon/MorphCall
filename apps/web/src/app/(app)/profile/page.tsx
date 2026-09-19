'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@morphcall/ui';
import { useMe } from '@/lib/queries';

/** /profile → your public profile page. */
export default function MyProfileRedirect() {
  const router = useRouter();
  const { data: me } = useMe();
  useEffect(() => {
    if (me?.profile) router.replace(`/u/${me.profile.username}`);
  }, [me, router]);
  return <Spinner label="Opening your profile" />;
}
