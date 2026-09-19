'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@morphcall/ui';

export function ThemeToggle({ onChange }: { onChange?: (theme: 'dark' | 'light') => void }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const next = isDark ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        setTheme(next);
        onChange?.(next);
      }}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
