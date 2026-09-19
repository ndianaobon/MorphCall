'use client';

import { Bell, Search } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge, Button, cn, ErrorState, Logo, LogoMark, Skeleton } from '@morphcall/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/queries';
import { RestrictedScreen } from '../restricted-screen';
import { MOBILE_NAV, NAV } from './nav';
import { UserMenu } from './user-menu';

function isActive(pathname: string, href: string, username?: string) {
  if (href === '/profile') return username ? pathname === `/u/${username}` : false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, error, refetch } = useMe();
  const { setTheme } = useTheme();
  const [query, setQuery] = useState('');

  // Account gate: signed out → login, not onboarded → onboarding.
  useEffect(() => {
    if (error instanceof ApiError && error.code === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (me && !me.restriction && !me.onboarded) {
      router.replace('/onboarding');
    }
  }, [error, me, pathname, router]);

  // Apply the theme saved on the account (unless it's "system").
  useEffect(() => {
    if (me && me.settings.theme !== 'system') setTheme(me.settings.theme);
  }, [me?.settings.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  if (me?.restriction) return <RestrictedScreen reason={me.restriction} />;
  if (error && !(error instanceof ApiError && error.code === 'unauthenticated')) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ErrorState
          description={errorMessage(error)}
          requestId={error instanceof ApiError ? error.requestId : undefined}
          action={<Button onClick={() => refetch()}>Try again</Button>}
        />
      </div>
    );
  }
  if (!me || !me.onboarded) return <ShellSkeleton />;

  const username = me.profile?.username;
  const hrefFor = (href: string) => (href === '/profile' && username ? `/u/${username}` : href);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4">
          <Link href="/home" aria-label="MorphCall home" className="shrink-0">
            <Logo className="hidden sm:inline-flex" />
            <LogoMark className="sm:hidden" />
          </Link>
          <form
            role="search"
            className="relative ml-2 max-w-md flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(
                `/discover${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`,
              );
            }}
          >
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, streams"
              aria-label="Search people"
              className="h-9 w-full rounded-full border border-border bg-bg pr-3 pl-9 text-body-sm text-text placeholder:text-subtle focus-visible:border-primary focus-visible:outline-none"
            />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="secondary" size="sm" asChild className="hidden md:inline-flex">
              <Link href="/discover">Explore</Link>
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Notifications">
              <Link href="/notifications">
                <Bell />
              </Link>
            </Button>
            <UserMenu me={me} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 pt-6 pb-24 lg:pb-10">
        <aside className="sticky top-22 hidden h-fit w-56 shrink-0 lg:block">
          <nav aria-label="App" className="rounded-lg border border-border bg-card p-2">
            <ul className="flex flex-col gap-0.5">
              {NAV.map(({ href, label, icon: Icon, soon }) => {
                const active = isActive(pathname, href, username);
                return (
                  <li key={href}>
                    <Link
                      href={hrefFor(href)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-sm px-3 py-2 text-body-sm transition-colors',
                        active
                          ? 'bg-primary/15 font-medium text-text'
                          : 'text-muted hover:bg-card-elevated hover:text-text',
                      )}
                    >
                      <Icon className={cn('size-4', active && 'text-primary')} aria-hidden />
                      {label}
                      {soon && <Badge className="ml-auto">Soon</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <nav
        aria-label="App"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg justify-around">
          {NAV.filter((n) => MOBILE_NAV.includes(n.href)).map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href, username);
            return (
              <li key={href}>
                <Link
                  href={hrefFor(href)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-w-16 flex-col items-center gap-0.5 py-2 text-[11px]',
                    active ? 'text-primary' : 'text-muted',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Loading">
      <div className="h-16 border-b border-border bg-surface" />
      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 pt-6">
        <Skeleton className="hidden h-96 w-56 lg:block" />
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}
