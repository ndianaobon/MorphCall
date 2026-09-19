'use client';

import { Check, Clock, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@morphcall/ui';
import { errorMessage } from '@/lib/api';
import { useFollow } from '@/lib/queries';

export function FollowButton({
  userId,
  displayName,
  following,
  requested,
  size = 'sm',
}: {
  userId: string;
  displayName: string;
  following: boolean;
  requested: boolean;
  size?: ButtonProps['size'];
}) {
  const follow = useFollow();
  const active = following || requested;
  return (
    <Button
      size={size}
      variant={active ? 'secondary' : 'primary'}
      aria-pressed={active}
      aria-label={
        following
          ? `Unfollow ${displayName}`
          : requested
            ? `Cancel follow request to ${displayName}`
            : `Follow ${displayName}`
      }
      onClick={() =>
        follow.mutate(
          { userId, follow: !active },
          {
            onSuccess: (res) => {
              if (res.status === 'requested') toast.success(`Request sent to ${displayName}.`);
            },
            onError: (err) => toast.error(errorMessage(err)),
          },
        )
      }
    >
      {following ? (
        <Check aria-hidden />
      ) : requested ? (
        <Clock aria-hidden />
      ) : (
        <UserPlus aria-hidden />
      )}
      {following ? 'Following' : requested ? 'Requested' : 'Follow'}
    </Button>
  );
}
