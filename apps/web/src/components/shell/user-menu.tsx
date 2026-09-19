'use client';

import { LogOut, Moon, Settings, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DropdownMenu } from 'radix-ui';
import { useQueryClient } from '@tanstack/react-query';
import type { Me } from '@morphcall/contracts';
import { Avatar, Badge } from '@morphcall/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useUpdateSettings } from '@/lib/queries';

const itemClass =
  'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-body-sm text-text outline-none data-[highlighted]:bg-card-elevated [&_svg]:size-4 [&_svg]:text-muted';

export function UserMenu({ me }: { me: Me }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const updateSettings = useUpdateSettings();
  const profile = me.profile!;
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-card-elevated"
        aria-label="Account menu"
      >
        <Avatar name={profile.displayName} src={profile.avatarUrl} size="sm" />
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-body-sm font-semibold">{profile.displayName}</span>
          <span className="block text-caption text-muted">
            {me.premium.hasPremiumAccess ? 'Premium' : 'Free plan'}
          </span>
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-60 rounded-md border border-border bg-card p-1 shadow-float"
        >
          <div className="flex flex-col gap-0.5 px-2 py-2">
            <span className="text-body-sm font-semibold">{profile.displayName}</span>
            <span className="text-caption text-muted">@{profile.username}</span>
            {me.premium.hasPremiumAccess && (
              <Badge variant="premium" className="mt-1 w-fit">
                Premium
              </Badge>
            )}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href={`/u/${profile.username}`}>
              <User aria-hidden /> View profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href="/settings">
              <Settings aria-hidden /> Settings
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={itemClass}
            onSelect={() => {
              setTheme(nextTheme);
              updateSettings.mutate({ theme: nextTheme });
            }}
          >
            {nextTheme === 'light' ? <Sun aria-hidden /> : <Moon aria-hidden />}
            {nextTheme === 'light' ? 'Light mode' : 'Dark mode'}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className={itemClass}
            onSelect={async () => {
              await supabaseBrowser().auth.signOut();
              qc.clear();
              router.replace('/');
              router.refresh();
            }}
          >
            <LogOut aria-hidden /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
