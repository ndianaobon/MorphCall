import { cn } from './cn';

/** MorphCall mark: a camera lens whose inner shape morphs into a second face (placeholder until brand work). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden>
      <defs>
        <linearGradient id="mc-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b5bf6" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#mc-g)" />
      <circle cx="13" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.4" />
      <path d="M19 12.5 25 9v14l-6-3.5" fill="#fff" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <LogoMark />
      <span className="text-h3">MorphCall</span>
    </span>
  );
}
