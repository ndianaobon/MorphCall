'use client';

import { CameraOff, Mic, MicOff, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@morphcall/ui';

type Status = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable';

/** Camera preview + mic level meter so users fix permissions before their first call. */
export function DeviceCheck() {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [level, setLevel] = useState(0);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => () => cleanup.current(), []);

  async function start() {
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (video.current) video.current.srcObject = stream;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        setLevel(Math.min(1, buf.reduce((a, b) => a + b, 0) / buf.length / 80));
        raf = requestAnimationFrame(tick);
      };
      tick();
      cleanup.current = () => {
        cancelAnimationFrame(raf);
        void ctx.close();
        stream.getTracks().forEach((t) => t.stop());
      };
      setStatus('ready');
    } catch (err) {
      const name = (err as DOMException)?.name;
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-[#03060c]">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          className="size-full -scale-x-100 object-cover"
        />
        {status !== 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            {status === 'denied' ? (
              <>
                <CameraOff className="size-8 text-warning" aria-hidden />
                <p className="text-body-sm">
                  Camera or microphone access is blocked. Click the camera icon in your browser’s
                  address bar, allow access, then try again.
                </p>
                <Button variant="secondary" onClick={start}>
                  Try again
                </Button>
              </>
            ) : status === 'unavailable' ? (
              <>
                <CameraOff className="size-8 text-warning" aria-hidden />
                <p className="text-body-sm">
                  We couldn’t find a camera or microphone. You can set this up later.
                </p>
                <Button variant="secondary" onClick={start}>
                  Try again
                </Button>
              </>
            ) : (
              <>
                <Video className="size-8 text-white/70" aria-hidden />
                <p className="text-body-sm text-white/80">
                  Check your camera and mic before your first call.
                </p>
                <Button onClick={start} loading={status === 'requesting'}>
                  Test camera & mic
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {status === 'ready' && (
        <div className="flex items-center gap-3" aria-live="polite">
          {level > 0.05 ? (
            <Mic className="size-4 text-success" aria-hidden />
          ) : (
            <MicOff className="size-4 text-muted" aria-hidden />
          )}
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-card-elevated"
            role="meter"
            aria-label="Microphone level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
          >
            <div
              className="h-full rounded-full bg-success transition-[width] duration-75"
              style={{ width: `${level * 100}%` }}
            />
          </div>
          <span className="text-caption text-muted">Say something</span>
        </div>
      )}
    </div>
  );
}
