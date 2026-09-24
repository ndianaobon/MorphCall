'use client';

import type { CallSummary } from '@morphcall/contracts';
import { ConnectionQuality, ConnectionState } from 'livekit-client';
import {
  CameraOff,
  Flag,
  PhoneOff,
  RefreshCw,
  Signal,
  SignalLow,
  SignalMedium,
  VolumeX,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, Badge, Button, Card, cn, Spinner } from '@morphcall/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { refreshCallToken, reportQuality, useCall, useCallAction } from '@/lib/call-queries';
import { useMe } from '@/lib/queries';
import { useCallRoom } from '@/lib/use-call-room';
import { ReportDialog } from '../safety/report-dialog';
import { CallControls, PremiumTeaser } from './call-controls';
import { LocalTile, RemoteTile } from './video-tile';

const CONTROLS_IDLE_MS = 3000;

export function CallScreen({ callId }: { callId: string }) {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: call, error } = useCall(callId);
  const room = useCallRoom();
  const endCall = useCallAction('end');
  const cancelCall = useCallAction('cancel');

  const [joined, setJoined] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [premiumTeaser, setPremiumTeaser] = useState<'identity' | 'voice' | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = call?.status;
  const isCaller = call?.direction === 'outgoing';
  const live = status === 'active';
  const finished = status && status !== 'ringing' && status !== 'active';

  // Join as soon as the call is active (the callee joins right after accepting).
  useEffect(() => {
    if (!live || joined) return;
    setJoined(true);
    (async () => {
      try {
        const credentials = await refreshCallToken(callId);
        await room.connect(credentials.url, credentials.token);
      } catch (err) {
        toast.error(errorMessage(err));
      }
    })();
  }, [live, joined, callId, room]);

  // Call timer, driven by the server's answeredAt so both sides agree.
  useEffect(() => {
    if (!live || !call?.answeredAt) return;
    const started = new Date(call.answeredAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [live, call?.answeredAt]);

  // Controls fade when idle, and come back on any pointer/key activity (docs/06 §5).
  const wake = useCallback(() => {
    setControlsVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_IDLE_MS);
  }, []);

  useEffect(() => {
    if (!live) return;
    wake();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [live, wake]);

  /** Runs a device toggle and shows why it failed, rather than doing nothing. */
  const runDevice = useCallback((action: () => Promise<void>) => {
    void action().catch((err: unknown) => toast.error(errorMessage(err)));
  }, []);

  const hangUp = useCallback(async () => {
    try {
      if (room.room) {
        await reportQuality(callId, { reconnects: 0 });
        await room.disconnect();
      }
      await (isCaller && status === 'ringing' ? cancelCall : endCall).mutateAsync(callId);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [callId, endCall, cancelCall, isCaller, status, room]);

  // The other person closed their tab or hung up: end the call on this side too.
  // In development LiveKit's webhooks can't reach localhost, so the client is the only signal.
  useEffect(() => {
    if (live && room.peerLeft) void hangUp();
  }, [live, room.peerLeft, hangUp]);

  // Keyboard shortcuts.
  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      wake();
      const key = e.key.toLowerCase();
      if (key === 'm') runDevice(room.toggleMic);
      if (key === 'v') runDevice(room.toggleCamera);
      if (key === 's') runDevice(room.toggleScreenShare);
      if (key === 'escape') setPremiumTeaser(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, room, wake, runDevice]);

  if (error) {
    return (
      <CallShell>
        <EndedCard
          title={
            error instanceof ApiError && error.status === 404
              ? 'Call not found'
              : 'Something went wrong'
          }
          description={errorMessage(error)}
          onDone={() => router.replace('/calls')}
        />
      </CallShell>
    );
  }
  if (!call || !me) {
    return (
      <CallShell>
        <Spinner label="Connecting to your call" />
      </CallShell>
    );
  }

  if (finished) {
    return (
      <CallShell>
        <CallSummaryCard call={call} onReport={() => setReportOpen(true)} />
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          target={{ type: 'call', id: call.id, name: call.peer.displayName }}
        />
      </CallShell>
    );
  }

  const reconnecting =
    room.connectionState === ConnectionState.Reconnecting ||
    (live && joined && room.connectionState === ConnectionState.Connecting);

  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-[#03060c] text-white"
      onPointerMove={wake}
      onPointerDown={wake}
    >
      {live ? (
        <RemoteTile
          track={room.peerVideo}
          audioTrack={room.peerAudio}
          name={call.peer.displayName}
          avatarUrl={call.peer.avatarUrl}
          cameraOn={room.peerCameraOn}
          micOn={room.peerMicOn}
          sharingScreen={room.peerSharingScreen}
        />
      ) : (
        <RingingStage call={call} isCaller={Boolean(isCaller)} />
      )}

      {live && (
        <LocalTile
          track={room.localVideo}
          name={me.profile?.displayName ?? 'You'}
          cameraOn={room.cameraEnabled}
          micOn={room.micEnabled}
        />
      )}

      {/* Top bar */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 transition-opacity duration-200 sm:gap-3 sm:px-4',
          controlsVisible || !live ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="flex items-center gap-3">
          <Avatar name={call.peer.displayName} src={call.peer.avatarUrl} size="sm" />
          <div className="leading-tight">
            <p className="text-body-sm font-semibold">{call.peer.displayName}</p>
            <p className="tabular text-caption text-white/70">
              {live
                ? `Connected · ${formatDuration(elapsed)}`
                : isCaller
                  ? 'Calling…'
                  : 'Incoming call'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {room.permission !== 'granted' && room.permission !== 'unknown' && (
            <Badge variant="warning">
              <CameraOff aria-hidden />
              <span className="hidden sm:inline">No camera or mic</span>
            </Badge>
          )}
          {live && <QualityChip quality={room.quality} />}
        </div>
      </div>

      {reconnecting && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
          <RefreshCw className="size-8 animate-spin text-white/80" aria-hidden />
          <p className="text-body">Reconnecting…</p>
          <p className="text-body-sm text-white/60">Check your connection. We’ll keep trying.</p>
        </div>
      )}

      {room.error && (
        <div className="absolute inset-x-4 top-20 z-40 mx-auto max-w-md rounded-md border border-danger/50 bg-danger/15 p-3 text-body-sm">
          {room.error}
        </div>
      )}

      {live && room.permission === 'insecure' && (
        <div className="absolute inset-x-4 top-20 z-40 mx-auto max-w-md rounded-md border border-warning/50 bg-warning/15 p-3 text-body-sm">
          <p className="font-semibold">Camera and microphone are blocked here</p>
          <p className="mt-1 text-white/80">
            Browsers only allow them over a secure connection. This page is on{' '}
            <code className="text-caption">
              {typeof window !== 'undefined' ? window.location.host : ''}
            </code>{' '}
            over plain HTTP. Open MorphCall on <code className="text-caption">localhost</code> or
            over HTTPS to use your camera. You can still see and hear the other person.
          </p>
        </div>
      )}

      {live && room.permission === 'denied' && (
        <div className="absolute inset-x-4 top-20 z-40 mx-auto max-w-md rounded-md border border-warning/50 bg-warning/15 p-3 text-body-sm">
          <p className="font-semibold">Camera and microphone access is blocked</p>
          <p className="mt-1 text-white/80">
            Allow them from the camera icon in your browser’s address bar, then press the mic or
            camera button again.
          </p>
        </div>
      )}

      {live && room.audioBlocked && (
        <div className="absolute inset-x-4 top-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-md border border-warning/50 bg-warning/15 p-3 text-body-sm">
          <VolumeX className="size-5 shrink-0 text-warning" aria-hidden />
          <span className="flex-1">Your browser blocked the call audio.</span>
          <Button size="sm" onClick={() => void room.enableAudio()}>
            Enable sound
          </Button>
        </div>
      )}

      <PremiumTeaser feature={premiumTeaser} onClose={() => setPremiumTeaser(null)} />

      {live ? (
        <CallControls
          micEnabled={room.micEnabled}
          cameraEnabled={room.cameraEnabled}
          screenSharing={room.screenSharing}
          devices={room.devices}
          activeDevices={room.activeDevices}
          onSwitchDevice={(kind, id) => void room.switchDevice(kind, id)}
          mediaBlocked={room.permission === 'insecure' || room.permission === 'unavailable'}
          onToggleMic={() => runDevice(room.toggleMic)}
          onToggleCamera={() => runDevice(room.toggleCamera)}
          onToggleScreenShare={() => runDevice(room.toggleScreenShare)}
          onEnd={() => void hangUp()}
          onPremiumFeature={setPremiumTeaser}
          visible={controlsVisible}
        />
      ) : (
        <div className="absolute bottom-10 left-1/2 z-30 -translate-x-1/2">
          <Button variant="destructive" size="lg" onClick={() => void hangUp()}>
            <PhoneOff aria-hidden /> {isCaller ? 'Cancel' : 'Decline'}
          </Button>
        </div>
      )}
    </div>
  );
}

function CallShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh items-center justify-center bg-[#03060c] p-4 text-white">
      {children}
    </div>
  );
}

function RingingStage({ call, isCaller }: { call: CallSummary; isCaller: boolean }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-4">
      <span className="relative flex">
        <Avatar name={call.peer.displayName} src={call.peer.avatarUrl} size="xl" />
        <span
          className="absolute inset-0 animate-ping rounded-full border-2 border-primary/50"
          aria-hidden
        />
      </span>
      <div className="text-center">
        <p className="text-h2 font-semibold">{call.peer.displayName}</p>
        <p className="text-body text-white/70" aria-live="polite">
          {isCaller ? 'Ringing…' : 'Connecting…'}
        </p>
      </div>
    </div>
  );
}

function CallSummaryCard({ call, onReport }: { call: CallSummary; onReport: () => void }) {
  const router = useRouter();
  const label =
    call.status === 'missed'
      ? 'Missed call'
      : call.status === 'declined'
        ? 'Call declined'
        : call.status === 'canceled'
          ? 'Call cancelled'
          : 'Call ended';
  return (
    <Card className="flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
      <Avatar name={call.peer.displayName} src={call.peer.avatarUrl} size="xl" />
      <div>
        <p className="text-h3 font-semibold text-text">{call.peer.displayName}</p>
        <p className="text-body-sm text-muted">
          {label}
          {call.durationSeconds ? ` · ${formatDuration(call.durationSeconds)}` : ''}
        </p>
        {call.endReason === 'blocked' && (
          <p className="mt-1 text-caption text-warning">This call ended because of a block.</p>
        )}
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button onClick={() => router.replace(`/u/${call.peer.username}`)}>Back to profile</Button>
        <Button variant="secondary" onClick={() => router.replace('/calls')}>
          Call history
        </Button>
        <Button variant="ghost" onClick={onReport}>
          <Flag aria-hidden /> Report this call
        </Button>
      </div>
    </Card>
  );
}

function EndedCard({
  title,
  description,
  onDone,
}: {
  title: string;
  description: string;
  onDone: () => void;
}) {
  return (
    <Card className="flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center">
      <p className="text-h3 font-semibold text-text">{title}</p>
      <p className="text-body-sm text-muted">{description}</p>
      <Button onClick={onDone}>Back to calls</Button>
    </Card>
  );
}

function QualityChip({ quality }: { quality: ConnectionQuality }) {
  const map = {
    [ConnectionQuality.Excellent]: {
      icon: Signal,
      label: 'Strong connection',
      tone: 'text-success',
    },
    [ConnectionQuality.Good]: {
      icon: SignalMedium,
      label: 'Good connection',
      tone: 'text-success',
    },
    [ConnectionQuality.Poor]: { icon: SignalLow, label: 'Weak connection', tone: 'text-warning' },
    [ConnectionQuality.Lost]: { icon: SignalLow, label: 'Connection lost', tone: 'text-danger' },
    [ConnectionQuality.Unknown]: {
      icon: Signal,
      label: 'Checking connection',
      tone: 'text-white/60',
    },
  } as const;
  const { icon: Icon, label, tone } = map[quality] ?? map[ConnectionQuality.Unknown];
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-caption',
        tone,
      )}
    >
      <Icon className="size-3.5" aria-hidden /> {label}
    </span>
  );
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
