'use client';

import { type Room, Track } from 'livekit-client';
import { MicOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar, cn } from '@morphcall/ui';

/** Attaches a LiveKit track to a media element for as long as it is on screen. */
function useAttached<T extends HTMLMediaElement>(track: Track | null | undefined) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!track || !el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return ref;
}

export function RemoteTile({
  track,
  audioTrack,
  name,
  avatarUrl,
  cameraOn,
  micOn,
  className,
}: {
  track: Track | null;
  audioTrack: Track | null;
  name: string;
  avatarUrl: string | null;
  cameraOn: boolean;
  micOn: boolean;
  className?: string;
}) {
  const videoRef = useAttached<HTMLVideoElement>(track);
  const audioRef = useAttached<HTMLAudioElement>(audioTrack);

  return (
    <div className={cn('relative size-full overflow-hidden bg-[#03060c]', className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={cn('size-full object-cover', !cameraOn && 'hidden')}
      />
      <audio ref={audioRef} autoPlay />
      {!cameraOn && (
        <div className="flex size-full flex-col items-center justify-center gap-3">
          <Avatar name={name} src={avatarUrl} size="xl" />
          <p className="text-body text-white/70">{name}’s camera is off</p>
        </div>
      )}
      {!micOn && (
        <span className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-caption text-white">
          <MicOff className="size-3.5" aria-hidden /> Muted
        </span>
      )}
    </div>
  );
}

/** Your own camera, picture-in-picture. Drag it; it snaps to the nearest corner. */
export function LocalTile({
  room,
  name,
  cameraOn,
  micOn,
}: {
  room: Room | null;
  name: string;
  cameraOn: boolean;
  micOn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [corner, setCorner] = useState<{ x: 'left' | 'right'; y: 'top' | 'bottom' }>({
    x: 'right',
    y: 'bottom',
  });

  useEffect(() => {
    const el = videoRef.current;
    const track = room?.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [room, cameraOn]);

  return (
    <div
      className={cn(
        'absolute z-20 w-28 cursor-grab overflow-hidden rounded-lg border border-white/20 bg-[#03060c] shadow-float active:cursor-grabbing sm:w-40',
        corner.y === 'top' ? 'top-20' : 'bottom-28',
        corner.x === 'left' ? 'left-4' : 'right-4',
      )}
      // Drop it anywhere; it settles into the nearest corner so it never covers the face.
      onPointerUp={(e) => {
        const { innerWidth, innerHeight } = window;
        setCorner({
          x: e.clientX < innerWidth / 2 ? 'left' : 'right',
          y: e.clientY < innerHeight / 2 ? 'top' : 'bottom',
        });
      }}
    >
      <div className="aspect-[3/4] sm:aspect-[4/3]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn('size-full -scale-x-100 object-cover', !cameraOn && 'hidden')}
        />
        {!cameraOn && (
          <div className="flex size-full items-center justify-center">
            <Avatar name={name} size="sm" />
          </div>
        )}
      </div>
      <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 text-[10px] text-white">
        You{!micOn && <MicOff className="size-2.5" aria-hidden />}
      </span>
    </div>
  );
}
