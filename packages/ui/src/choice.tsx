'use client';

import { Check } from 'lucide-react';
import { RadioGroup as RadioPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from './cn';

/** Toggle chip (interests, filters). Uses aria-pressed so state is not colour-only. */
export function Chip({
  selected,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-body-sm transition-colors',
        selected
          ? 'border-primary bg-primary/15 text-text'
          : 'border-border bg-card text-muted hover:border-border-strong hover:text-text',
        className,
      )}
      {...props}
    >
      {selected && <Check className="size-3.5 text-primary" aria-hidden />}
      {children}
    </button>
  );
}

export interface OptionCardsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string; description?: string }[];
  'aria-label': string;
  className?: string;
  disabled?: boolean;
}

/** Radio group rendered as selectable cards (privacy settings etc.). */
export function OptionCards<T extends string>({
  value,
  onValueChange,
  options,
  className,
  disabled,
  ...aria
}: OptionCardsProps<T>) {
  return (
    <RadioPrimitive.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      disabled={disabled}
      className={cn('grid gap-2 sm:grid-cols-2', className)}
      aria-label={aria['aria-label']}
    >
      {options.map((o) => (
        <RadioPrimitive.Item
          key={o.value}
          value={o.value}
          className={cn(
            'flex items-start gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors',
            'hover:border-border-strong data-[state=checked]:border-primary data-[state=checked]:bg-primary/10',
          )}
        >
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong">
            <RadioPrimitive.Indicator className="size-2 rounded-full bg-primary" />
          </span>
          <span className="flex flex-col">
            <span className="text-body-sm font-medium text-text">{o.label}</span>
            {o.description && <span className="text-caption text-muted">{o.description}</span>}
          </span>
        </RadioPrimitive.Item>
      ))}
    </RadioPrimitive.Root>
  );
}
