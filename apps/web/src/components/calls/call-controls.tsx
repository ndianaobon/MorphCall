'use client';

import {
  AudioLines,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  ScanFace,
  Video,
  VideoOff,
} from 'lucide-react';
import Link from 'next/link';
import { Tooltip } from 'radix-ui';
import { Badge, Button, cn } from '@morphcall/ui';

function ControlButton({
  label,
  onClick,
  active = true,
  danger,
  locked,
  children,
}: {
  label: string;
  onClick?: () => void;
  /** false renders the "off" state (e.g. muted), not a disabled button. */
  active?: boolean;
  danger?: boolean;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={locked ? undefined : active}
          className={cn(
            'relative flex size-11 items-center justify-center rounded-full text-white transition-colors',
            danger
              ? 'bg-danger hover:opacity-90'
              : active
                ? 'bg-white/15 hover:bg-white/25'
                : 'bg-danger/90 hover:bg-danger',
            locked && 'bg-white/10 text-white/60',
          )}
        >
          {children}
          {locked && (
            <span className="absolute -top-1 -right-1 rounded-full bg-premium px-1 text-[9px] font-semibold text-white">
              PRO
            </span>
          )}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={8}
          className="z-50 rounded-sm bg-black/85 px-2 py-1 text-caption text-white"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function CallControls({
  micEnabled,
  cameraEnabled,
  screenSharing,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onEnd,
  onPremiumFeature,
  visible,
}: {
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onEnd: () => void;
  onPremiumFeature: (feature: 'identity' | 'voice') => void;
  visible: boolean;
}) {
  return (
    <Tooltip.Provider delayDuration={300}>
      <div
        className={cn(
          'absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-2 backdrop-blur-md transition-opacity duration-200',
          visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <ControlButton
          label={micEnabled ? 'Mute (M)' : 'Unmute (M)'}
          active={micEnabled}
          onClick={onToggleMic}
        >
          {micEnabled ? (
            <Mic className="size-5" aria-hidden />
          ) : (
            <MicOff className="size-5" aria-hidden />
          )}
        </ControlButton>
        <ControlButton
          label={cameraEnabled ? 'Turn camera off (V)' : 'Turn camera on (V)'}
          active={cameraEnabled}
          onClick={onToggleCamera}
        >
          {cameraEnabled ? (
            <Video className="size-5" aria-hidden />
          ) : (
            <VideoOff className="size-5" aria-hidden />
          )}
        </ControlButton>
        <ControlButton
          label={screenSharing ? 'Stop sharing (S)' : 'Share screen (S)'}
          active={!screenSharing}
          onClick={onToggleScreenShare}
        >
          <MonitorUp className="size-5" aria-hidden />
        </ControlButton>

        <span className="mx-1 h-6 w-px bg-white/20" aria-hidden />

        {/* Premium AI controls live here from Stage 5; locked for everyone today (D7). */}
        <ControlButton
          label="AI Identity — Premium"
          locked
          onClick={() => onPremiumFeature('identity')}
        >
          <ScanFace className="size-5" aria-hidden />
        </ControlButton>
        <ControlButton label="AI Voice — Premium" locked onClick={() => onPremiumFeature('voice')}>
          <AudioLines className="size-5" aria-hidden />
        </ControlButton>

        <span className="mx-1 h-6 w-px bg-white/20" aria-hidden />

        <ControlButton label="End call" danger onClick={onEnd}>
          <PhoneOff className="size-5" aria-hidden />
        </ControlButton>
      </div>
    </Tooltip.Provider>
  );
}

export function PremiumTeaser({
  feature,
  onClose,
}: {
  feature: 'identity' | 'voice' | null;
  onClose: () => void;
}) {
  if (!feature) return null;
  const title =
    feature === 'identity' ? 'AI Identity is a Premium Feature' : 'AI Voice is a Premium Feature';
  const body =
    feature === 'identity'
      ? 'Transform your appearance in real time during video calls using your saved AI identities.'
      : 'Change how you sound in real time during calls using your voice library.';
  return (
    <div className="absolute inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-lg border border-premium/50 bg-card/95 p-4 backdrop-blur-md sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
      <div className="flex items-start gap-3">
        <Badge variant="premium" className="mt-0.5">
          <MoreHorizontal className="hidden" aria-hidden />
          Premium
        </Badge>
        <div className="flex-1">
          <p className="text-body-sm font-semibold">{title}</p>
          <p className="text-caption text-muted">{body}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Not now
        </Button>
        <Button size="sm" variant="premium" asChild>
          <Link href="/premium">See Premium</Link>
        </Button>
      </div>
    </div>
  );
}
