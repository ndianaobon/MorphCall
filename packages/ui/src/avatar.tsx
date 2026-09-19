'use client';

import * as React from 'react';
import { cn } from './cn';

const SIZES = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-caption',
  md: 'size-10 text-body-sm',
  lg: 'size-16 text-h3',
  xl: 'size-24 text-h2',
} as const;
const DOT = { xs: 'size-2', sm: 'size-2.5', md: 'size-3', lg: 'size-4', xl: 'size-5' } as const;

/** Deterministic, accessible background for initials (no avatar uploaded). */
const PALETTE = [
  'bg-[#5b5bf6]',
  'bg-[#0e9f8a]',
  'bg-[#d9467a]',
  'bg-[#c2410c]',
  'bg-[#7c3aed]',
  'bg-[#0369a1]',
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  /** Presence dot. `null`/undefined hides it (e.g. the viewer may not see presence). */
  online?: boolean | null;
  className?: string;
}

export function Avatar({ name, src, size = 'md', online, className }: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const showImage = src && !failed;
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-full font-semibold text-white',
          SIZES[size],
          !showImage && PALETTE[hash(name) % PALETTE.length],
        )}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="size-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span aria-hidden>{initials(name)}</span>
        )}
      </span>
      {online != null && (
        <span
          className={cn(
            'absolute right-0 bottom-0 rounded-full ring-2 ring-card',
            DOT[size],
            online ? 'bg-success' : 'bg-subtle',
          )}
          aria-label={online ? 'Online' : 'Offline'}
          role="img"
        />
      )}
    </span>
  );
}
