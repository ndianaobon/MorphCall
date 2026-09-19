'use client';

import { Check, Circle } from 'lucide-react';
import { cn, Field, Input } from '@morphcall/ui';
import { PASSWORD_RULES } from './password-rules';

export function NewPasswordField({
  value,
  onChange,
  label = 'Password',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Field id="new-password" label={label}>
        {(a) => (
          <Input
            {...a}
            aria-describedby="password-rules"
            type="password"
            autoComplete="new-password"
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </Field>
      <ul id="password-rules" className="flex flex-wrap gap-x-4 gap-y-1">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(value);
          return (
            <li
              key={r.id}
              className={cn(
                'flex items-center gap-1 text-caption',
                ok ? 'text-success' : 'text-muted',
              )}
            >
              {ok ? (
                <Check className="size-3" aria-hidden />
              ) : (
                <Circle className="size-3" aria-hidden />
              )}
              {r.label}
              <span className="sr-only">{ok ? '(met)' : '(not met)'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
