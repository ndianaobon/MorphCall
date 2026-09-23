'use client';

import type { CallSummary } from '@morphcall/contracts';
import { Phone, PhoneOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  Avatar,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@morphcall/ui';
import { errorMessage } from '@/lib/api';
import { useAcceptCall, useCallAction } from '@/lib/call-queries';
import { useRealtime } from '@/lib/realtime';

/** Soft two-tone ring, generated in the browser so we ship no audio file. */
function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      try {
        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const beep = () => {
          if (stopped) return;
          const now = ctx.currentTime;
          for (const [i, freq] of [660, 520].entries()) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.0001, now + i * 0.25);
            gain.gain.exponentialRampToValueAtTime(0.06, now + i * 0.25 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.25 + 0.22);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + i * 0.25);
            osc.stop(now + i * 0.25 + 0.25);
          }
        };
        beep();
        timer = setInterval(beep, 2500);
      } catch {
        // Autoplay policy blocked audio: the dialog is still visible.
      }
    };
    start();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [active]);
}

export function IncomingCall() {
  const { incoming, dismissIncoming } = useRealtime();
  const router = useRouter();
  const accept = useAcceptCall();
  const decline = useCallAction('decline');
  useRingtone(Boolean(incoming));

  const call: CallSummary | null = incoming;
  if (!call) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && dismissIncoming()}>
      <DialogContent hideClose className="items-center text-center">
        <span className="relative mt-2 flex">
          <Avatar name={call.peer.displayName} src={call.peer.avatarUrl} size="xl" />
          <span
            className="absolute inset-0 animate-ping rounded-full border-2 border-primary/60"
            aria-hidden
          />
        </span>
        <DialogTitle>{call.peer.displayName} is calling</DialogTitle>
        <DialogDescription>@{call.peer.username} wants to video call you.</DialogDescription>
        <div className="mt-2 flex w-full gap-3">
          <Button
            variant="destructive"
            className="flex-1"
            loading={decline.isPending}
            onClick={() =>
              decline.mutate(call.id, {
                onSettled: dismissIncoming,
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          >
            <PhoneOff aria-hidden /> Decline
          </Button>
          <Button
            className="flex-1 bg-success hover:opacity-90"
            loading={accept.isPending}
            onClick={() =>
              accept.mutate(call.id, {
                onSuccess: () => {
                  dismissIncoming();
                  router.push(`/call/${call.id}`);
                },
                onError: (err) => {
                  toast.error(errorMessage(err));
                  dismissIncoming();
                },
              })
            }
          >
            <Phone aria-hidden /> Accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
