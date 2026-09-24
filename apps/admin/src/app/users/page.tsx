'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar, Badge, Card, cn, EmptyState, Input, Skeleton } from '@morphcall/ui';
import { AdminShell } from '@/components/admin-shell';
import { useUserSearch } from '@/lib/queries';

const STATUSES = ['all', 'active', 'suspended', 'banned'] as const;

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const search = useUserSearch(debounced, status);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const people = search.data?.data ?? [];

  return (
    <AdminShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-h2 font-bold">People</h1>
          <p className="text-body-sm text-muted">Search by username, display name or email.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-sm sm:flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
              aria-hidden
            />
            <Input
              className="pl-9"
              type="search"
              placeholder="Search people"
              aria-label="Search people"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex gap-1" role="tablist" aria-label="Account status">
            {STATUSES.map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={status === s}
                onClick={() => setStatus(s)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-body-sm capitalize',
                  status === s ? 'bg-primary/15 text-text' : 'text-muted hover:text-text',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {search.isLoading ? (
          <Skeleton className="h-40" />
        ) : people.length === 0 ? (
          <Card>
            <EmptyState title="No matches" description="Try a different search or status." />
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {people.map((person) => (
              <Link
                key={person.id}
                href={`/users/${person.id}`}
                className="flex items-center gap-3 p-4 hover:bg-card-elevated"
              >
                <Avatar name={person.displayName ?? person.email} src={person.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold">
                    {person.displayName ?? '(no profile yet)'}
                  </p>
                  <p className="truncate text-caption text-muted">
                    {person.username ? `@${person.username} · ` : ''}
                    {person.email}
                  </p>
                </div>
                {person.reportsAgainst > 0 && (
                  <Badge variant={person.reportsAgainst > 2 ? 'danger' : 'neutral'}>
                    {person.reportsAgainst} reports
                  </Badge>
                )}
                <Badge variant={person.status === 'active' ? 'success' : 'warning'}>
                  {person.status}
                </Badge>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
