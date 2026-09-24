'use client';

import { Flag, LogOut, ScrollText, ShieldAlert, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, cn, EmptyState, Logo, Spinner } from '@morphcall/ui';
import { ApiError } from '@/lib/api';
import { useAdminMe } from '@/lib/queries';
import { supabaseBrowser } from '@/lib/supabase/client';

const NAV = [
  { href: '/', label: 'Queue', icon: Flag },
  { href: '/users', label: 'People', icon: Users },
  { href: '/audit', label: 'Audit log', icon: ScrollText, minRole: 'admin' as const },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me, error, isLoading } = useAdminMe();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Checking your access" />
      </div>
    );
  }

  // The API returns 404 for non-staff, so we never confirm the tool exists.
  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <Card className="max-w-md">
          <EmptyState
            icon={<ShieldAlert className="text-warning" />}
            title="No access"
            description={
              error instanceof ApiError && error.status === 401
                ? 'Your session expired. Sign in again.'
                : 'This account isn’t a staff account.'
            }
            action={
              <Button
                variant="secondary"
                onClick={async () => {
                  await supabaseBrowser().auth.signOut();
                  qc.clear();
                  router.replace('/login');
                }}
              >
                Sign out
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const visible = NAV.filter(
    (item) => !item.minRole || me?.role === 'admin' || me?.role === 'super_admin',
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <Badge variant="primary">Admin</Badge>
          </Link>
          <nav aria-label="Admin" className="ml-4 flex items-center gap-1">
            {visible.map(({ href, label, icon: Icon }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-3 py-1.5 text-body-sm',
                    active ? 'bg-primary/15 text-text' : 'text-muted hover:text-text',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-caption text-muted sm:block">
              {me?.email} · <span className="text-text">{me?.role.replace('_', ' ')}</span>
              {!me?.mfa && <span className="ml-1 text-warning">(no 2FA)</span>}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              onClick={async () => {
                await supabaseBrowser().auth.signOut();
                qc.clear();
                router.replace('/login');
              }}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
