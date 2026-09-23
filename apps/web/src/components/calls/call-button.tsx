'use client';

import { Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@morphcall/ui';
import { ApiError } from '@/lib/api';
import { useStartCall } from '@/lib/call-queries';

/** Starts a call and takes you to the call screen; every failure has its own message. */
export function CallButton({
  userId,
  displayName,
  size = 'sm',
  variant = 'secondary',
  withLabel = false,
}: {
  userId: string;
  displayName: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  withLabel?: boolean;
}) {
  const router = useRouter();
  const start = useStartCall();

  return (
    <Button
      size={size}
      variant={variant}
      loading={start.isPending}
      aria-label={`Video call ${displayName}`}
      onClick={() =>
        start.mutate(userId, {
          onSuccess: (call) => router.push(`/call/${call.id}`),
          onError: (err) => {
            const code = err instanceof ApiError ? err.code : 'server_error';
            const message =
              code === 'user_busy'
                ? `${displayName} is on another call.`
                : code === 'privacy_restricted'
                  ? err instanceof ApiError
                    ? err.message
                    : `${displayName} isn’t accepting calls.`
                  : code === 'not_found'
                    ? 'This person is no longer available.'
                    : err instanceof ApiError
                      ? err.message
                      : 'Could not start the call.';
            toast.error(message);
          },
        })
      }
    >
      {!start.isPending && <Video aria-hidden />}
      {withLabel && 'Call'}
    </Button>
  );
}
