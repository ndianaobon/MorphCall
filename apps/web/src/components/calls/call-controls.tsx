'use client';

import {
  AudioLines,
  Camera,
  Check,
  Mic,
  MicOff,
  MonitorUp,
  MessageSquare,
  MoreHorizontal,
  PhoneOff,
  ScanFace,
  Settings2,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import Link from 'next/link';
import { DropdownMenu, Tooltip } from 'radix-ui';
import { Badge, Button, cn } from '@morphcall/ui';
import type { DeviceOption } from '@/lib/use-call-room';

function ControlButton({
  label,
  onClick,
  /** Set only for real toggles (mic, camera, screen share) — not for End call. */
  pressed,
  /** false renders the "off" state (muted, camera off) — not a disabled button. */
  on = true,
  /** Highlights an active mode, e.g. while sharing your screen. */
  highlighted,
  danger,
  locked,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick?: () => void;
  pressed?: boolean;
  on?: boolean;
  highlighted?: boolean;
  danger?: boolean;
  locked?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={pressed}
          className={cn(
            // 44px touch target on phones as well as desktop.
            'relative flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-colors',
            danger
              ? 'bg-danger hover:opacity-90'
              : highlighted
                ? 'bg-primary hover:bg-primary-hover'
                : on
                  ? 'bg-white/15 hover:bg-white/25'
                  : 'bg-danger/90 hover:bg-danger',
            (locked || disabled) && 'bg-white/10 text-white/50',
            disabled && 'cursor-not-allowed',
            className,
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
          className="z-50 hidden rounded-sm bg-black/85 px-2 py-1 text-caption text-white sm:block"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

const menuItem =
  'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-body-sm text-text outline-none data-[highlighted]:bg-card-elevated';
const menuContent =
  'z-50 max-h-[60vh] w-64 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-float';

function DeviceGroup({
  icon,
  title,
  options,
  active,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  options: DeviceOption[];
  active?: string;
  onSelect: (deviceId: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <>
      <DropdownMenu.Label className="flex items-center gap-2 px-2 py-1.5 text-caption text-muted">
        {icon} {title}
      </DropdownMenu.Label>
      {options.map((device) => (
        <DropdownMenu.Item
          key={device.deviceId}
          className={menuItem}
          onSelect={() => onSelect(device.deviceId)}
        >
          <Check
            className={cn(
              'size-3.5 shrink-0',
              device.deviceId === active ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden
          />
          <span className="truncate">{device.label}</span>
        </DropdownMenu.Item>
      ))}
    </>
  );
}

export interface CallControlsProps {
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  /** No camera or microphone is usable (blocked, missing, or an insecure connection). */
  mediaBlocked?: boolean;
  devices: { cameras: DeviceOption[]; microphones: DeviceOption[]; speakers: DeviceOption[] };
  activeDevices: { camera?: string; microphone?: string; speaker?: string };
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onSwitchDevice: (kind: MediaDeviceKind, deviceId: string) => void;
  onEnd: () => void;
  onPremiumFeature: (feature: 'identity' | 'voice') => void;
  visible: boolean;
}

export function CallControls({
  micEnabled,
  cameraEnabled,
  screenSharing,
  mediaBlocked,
  devices,
  activeDevices,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onSwitchDevice,
  onEnd,
  onPremiumFeature,
  visible,
}: CallControlsProps) {
  const hasDevices =
    devices.cameras.length + devices.microphones.length + devices.speakers.length > 0;
  // Screen sharing needs a desktop-style picker; phones don't have one.
  const canShareScreen =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  const deviceGroups = (
    <>
      <DeviceGroup
        icon={<Camera className="size-3.5" aria-hidden />}
        title="Camera"
        options={devices.cameras}
        active={activeDevices.camera}
        onSelect={(id) => onSwitchDevice('videoinput', id)}
      />
      <DeviceGroup
        icon={<Mic className="size-3.5" aria-hidden />}
        title="Microphone"
        options={devices.microphones}
        active={activeDevices.microphone}
        onSelect={(id) => onSwitchDevice('audioinput', id)}
      />
      <DeviceGroup
        icon={<Volume2 className="size-3.5" aria-hidden />}
        title="Speaker"
        options={devices.speakers}
        active={activeDevices.speaker}
        onSelect={(id) => onSwitchDevice('audiooutput', id)}
      />
    </>
  );

  return (
    <Tooltip.Provider delayDuration={300}>
      <div
        className={cn(
          'absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-2 backdrop-blur-md transition-opacity duration-200 sm:bottom-6 sm:gap-2 sm:px-3',
          visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        {/* Mic, camera and End call stay visible at every screen size. */}
        <ControlButton
          label={micEnabled ? 'Mute (M)' : 'Unmute (M)'}
          on={micEnabled}
          pressed={!micEnabled}
          disabled={mediaBlocked}
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
          on={cameraEnabled}
          pressed={!cameraEnabled}
          disabled={mediaBlocked}
          onClick={onToggleCamera}
        >
          {cameraEnabled ? (
            <Video className="size-5" aria-hidden />
          ) : (
            <VideoOff className="size-5" aria-hidden />
          )}
        </ControlButton>

        {/* Secondary controls sit inline from the `sm` breakpoint up. */}
        {canShareScreen && (
          <ControlButton
            label={screenSharing ? 'Stop sharing (S)' : 'Share screen (S)'}
            highlighted={screenSharing}
            pressed={screenSharing}
            onClick={onToggleScreenShare}
            className="hidden sm:flex"
          >
            <MonitorUp className="size-5" aria-hidden />
          </ControlButton>
        )}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Audio and video settings"
              disabled={!hasDevices}
              className={cn(
                'hidden size-11 shrink-0 items-center justify-center rounded-full text-white transition-colors sm:flex',
                hasDevices ? 'bg-white/15 hover:bg-white/25' : 'bg-white/10 text-white/50',
              )}
            >
              <Settings2 className="size-5" aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content side="top" sideOffset={10} align="center" className={menuContent}>
              {deviceGroups}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <ControlButton label="Chat — coming soon" disabled className="hidden sm:flex">
          <MessageSquare className="size-5" aria-hidden />
        </ControlButton>

        <span className="mx-1 hidden h-6 w-px bg-white/20 sm:block" aria-hidden />

        <ControlButton
          label="AI Identity — Premium"
          locked
          onClick={() => onPremiumFeature('identity')}
          className="hidden sm:flex"
        >
          <ScanFace className="size-5" aria-hidden />
        </ControlButton>
        <ControlButton
          label="AI Voice — Premium"
          locked
          onClick={() => onPremiumFeature('voice')}
          className="hidden sm:flex"
        >
          <AudioLines className="size-5" aria-hidden />
        </ControlButton>

        {/* On phones those fold into one menu, so the bar always fits the screen. */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="More call options"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:hidden"
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content side="top" sideOffset={10} align="end" className={menuContent}>
              {canShareScreen && (
                <DropdownMenu.Item className={menuItem} onSelect={onToggleScreenShare}>
                  <MonitorUp className="size-4 text-muted" aria-hidden />
                  {screenSharing ? 'Stop sharing' : 'Share screen'}
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item className={menuItem} onSelect={() => onPremiumFeature('identity')}>
                <ScanFace className="size-4 text-premium" aria-hidden /> AI Identity
                <Badge variant="premium" className="ml-auto">
                  Premium
                </Badge>
              </DropdownMenu.Item>
              <DropdownMenu.Item className={menuItem} onSelect={() => onPremiumFeature('voice')}>
                <AudioLines className="size-4 text-premium" aria-hidden /> AI Voice
                <Badge variant="premium" className="ml-auto">
                  Premium
                </Badge>
              </DropdownMenu.Item>
              <DropdownMenu.Item className={cn(menuItem, 'opacity-50')} disabled>
                <MessageSquare className="size-4 text-muted" aria-hidden /> Chat — coming soon
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              {deviceGroups}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <span className="mx-0.5 h-6 w-px bg-white/20 sm:mx-1" aria-hidden />

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
    <div className="absolute inset-x-4 bottom-28 z-40 mx-auto max-w-md rounded-lg border border-premium/50 bg-card/95 p-4 backdrop-blur-md sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
      <div className="flex items-start gap-3">
        <Badge variant="premium" className="mt-0.5">
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
