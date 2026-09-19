import { Mic, PhoneOff, ScanFace, Video, AudioLines } from 'lucide-react';
import { cn } from '@morphcall/ui';

/** Illustrated face used instead of stock photos (no real person is depicted). */
export function IllustratedFace({
  hue = 250,
  variant = 'a',
  className,
}: {
  hue?: number;
  variant?: 'a' | 'b';
  className?: string;
}) {
  const skin = `hsl(${variant === 'a' ? 28 : 20} 45% ${variant === 'a' ? 62 : 48}%)`;
  const hair = variant === 'a' ? 'hsl(20 30% 14%)' : 'hsl(265 60% 70%)';
  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid slice"
      className={cn('size-full', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`bg-${variant}-${hue}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 70% 30%)`} />
          <stop offset="1" stopColor={`hsl(${hue + 40} 60% 14%)`} />
        </linearGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#bg-${variant}-${hue})`} />
      <path d="M40 200c6-40 32-58 60-58s54 18 60 58z" fill={`hsl(${hue} 30% 22%)`} />
      <rect x="86" y="118" width="28" height="30" rx="10" fill={skin} />
      <ellipse cx="100" cy="92" rx="36" ry="42" fill={skin} />
      {variant === 'a' ? (
        <path d="M62 88c0-30 16-46 38-46s40 14 38 46c-8-16-22-22-38-22s-30 6-38 22z" fill={hair} />
      ) : (
        <path
          d="M60 96c-4-38 16-56 40-56s46 16 40 56c-4-10-8-26-40-28-30 2-36 18-40 28z"
          fill={hair}
        />
      )}
      <ellipse cx="86" cy="94" rx="4" ry="4.5" fill="#1b1b2a" />
      <ellipse cx="114" cy="94" rx="4" ry="4.5" fill="#1b1b2a" />
      <path
        d="M88 114c7 7 17 7 24 0"
        stroke="#5a2a2a"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The dashboard's call card (Uizard mockup) as a live-looking hero illustration. */
export function CallPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/10 bg-[#0b1220] shadow-float',
        className,
      )}
      role="img"
      aria-label="Illustration of a MorphCall video call with AI Identity turned on"
    >
      <div className="flex items-center justify-between px-4 py-3 text-caption text-white/80">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#5b5bf6] text-[11px] font-semibold text-white">
            RM
          </span>
          <div className="leading-tight">
            <p className="font-semibold text-white">Ravi Menon</p>
            <p className="tabular text-white/60">Connected · 00:12:34</p>
          </div>
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#22d3ee]/15 px-2 py-0.5 text-[11px] font-medium text-[#22d3ee]">
            <ScanFace className="size-3" aria-hidden /> AI Identity: ON
          </span>
        </div>
        <span className="hidden text-white/60 sm:inline">HD · Stable</span>
      </div>
      <div className="relative mx-3 mb-3 aspect-[16/10] overflow-hidden rounded-lg">
        <IllustratedFace hue={225} variant="a" />
        <span className="absolute top-3 left-3 rounded-md bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-[#22d3ee]">
          AI
        </span>
        <div className="absolute right-3 bottom-16 w-[26%] overflow-hidden rounded-md border border-white/20 shadow-lg">
          <div className="aspect-[4/5]">
            <IllustratedFace hue={300} variant="b" />
          </div>
          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">
            You (AI)
          </span>
        </div>
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-3 py-2 backdrop-blur-md">
          {[Mic, Video].map((Icon, i) => (
            <span
              key={i}
              className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <Icon className="size-4" aria-hidden />
            </span>
          ))}
          <span className="flex h-8 items-center gap-1 rounded-full bg-[#22d3ee]/20 px-3 text-[11px] font-medium text-[#22d3ee]">
            <ScanFace className="size-3.5" aria-hidden /> Identity
          </span>
          <span className="flex h-8 items-center gap-1 rounded-full bg-white/10 px-3 text-[11px] font-medium text-white">
            <AudioLines className="size-3.5" aria-hidden /> Voice
          </span>
          <span className="flex size-8 items-center justify-center rounded-full bg-[#ef4444] text-white">
            <PhoneOff className="size-4" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}
