'use client';

import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { USERNAME_REGEX } from '@morphcall/contracts';
import { Field, Input, Spinner } from '@morphcall/ui';
import { checkUsername } from '@/lib/queries';

export type UsernameState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

/** Username input with debounced live availability check. */
export function UsernameField({
  value,
  onChange,
  current,
  onStateChange,
}: {
  value: string;
  onChange: (v: string) => void;
  current?: string;
  onStateChange?: (s: UsernameState) => void;
}) {
  const [state, setState] = useState<UsernameState>('idle');

  useEffect(() => {
    const v = value.trim().toLowerCase();
    if (!v || v === current) return update('idle');
    if (!USERNAME_REGEX.test(v)) return update('invalid');
    update('checking');
    const t = setTimeout(async () => {
      try {
        const res = await checkUsername(v);
        update(res.available ? 'available' : 'taken');
      } catch {
        update('idle');
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, current]);

  function update(s: UsernameState) {
    setState(s);
    onStateChange?.(s);
  }

  const hint =
    state === 'checking' ? (
      <Spinner label="Checking availability" />
    ) : state === 'available' ? (
      <span className="inline-flex items-center gap-1 text-success">
        <Check className="size-3" aria-hidden /> @{value.toLowerCase()} is available
      </span>
    ) : (
      '3–24 characters: lowercase letters, numbers, “_” or “.”'
    );
  const error =
    state === 'taken'
      ? 'That username is taken.'
      : state === 'invalid'
        ? 'Use 3–24 lowercase letters, numbers, “_” or “.”'
        : null;

  return (
    <Field id="username" label="Username" hint={hint} error={error}>
      {(a) => (
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
            @
          </span>
          <Input
            {...a}
            className="pl-7"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={24}
            value={value}
            onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s/g, ''))}
          />
          {state === 'taken' && (
            <X
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-danger"
              aria-hidden
            />
          )}
        </div>
      )}
    </Field>
  );
}
