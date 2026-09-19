'use client';

import { Tooltip } from 'radix-ui';
import { Button, type ButtonProps } from '@morphcall/ui';

/**
 * Visible-but-disabled action for features landing in a later stage (calls: Stage 2,
 * messages: Stage 7). Wrapped in a span so the tooltip still works on a disabled button.
 */
export function ComingSoonButton({
  label,
  when,
  children,
  ...props
}: ButtonProps & { label: string; when: string }) {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span tabIndex={0} className="inline-flex rounded-md">
            <Button {...props} disabled aria-label={`${label} — ${when}`}>
              {children}
            </Button>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 rounded-sm bg-text px-2 py-1 text-caption text-bg shadow-float"
          >
            {label} — {when}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
