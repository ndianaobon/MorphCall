'use client';

import { SearchX, Users } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button, Card, Chip, EmptyState, ErrorState, Input } from '@morphcall/ui';
import { ProfileCardSkeleton, ProfileCardView } from '@/components/social/profile-card';
import { ApiError, errorMessage } from '@/lib/api';
import { useDiscover, useInterests } from '@/lib/queries';

export default function DiscoverPage() {
  return (
    <Suspense>
      <Discover />
    </Suspense>
  );
}

function Discover() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(q);
  const [interests, setInterests] = useState<string[]>(
    params.get('interests')?.split(',').filter(Boolean) ?? [],
  );
  const [online, setOnline] = useState(params.get('online') === 'true');
  const { data: allInterests } = useInterests();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Keep the URL shareable.
  useEffect(() => {
    const next = new URLSearchParams();
    if (debounced) next.set('q', debounced);
    if (interests.length) next.set('interests', interests.join(','));
    if (online) next.set('online', 'true');
    const s = next.toString();
    router.replace(`${pathname}${s ? `?${s}` : ''}`, { scroll: false });
  }, [debounced, interests, online, pathname, router]);

  const query = useDiscover({ q: debounced, interests, online });
  const people = query.data?.pages.flatMap((p) => p.data) ?? [];
  const filtered = Boolean(debounced || interests.length || online);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 font-bold">Discover</h1>
        <p className="text-body-sm text-muted">
          Find people by name, interests, or who’s online right now.
        </p>
      </div>

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="search"
            placeholder="Search by name or @username"
            aria-label="Search people"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:max-w-sm"
          />
          <Chip selected={online} onClick={() => setOnline(!online)}>
            <span className="size-2 rounded-full bg-success" aria-hidden /> Online now
          </Chip>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('');
                setInterests([]);
                setOnline(false);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by interest">
          {allInterests?.map((i) => (
            <Chip
              key={i.slug}
              selected={interests.includes(i.slug)}
              onClick={() =>
                setInterests((cur) =>
                  cur.includes(i.slug) ? cur.filter((s) => s !== i.slug) : [...cur, i.slug],
                )
              }
            >
              {i.label}
            </Chip>
          ))}
        </div>
      </Card>

      <section aria-live="polite" aria-busy={query.isLoading}>
        {query.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <ProfileCardSkeleton key={i} />
            ))}
          </div>
        ) : query.error ? (
          <ErrorState
            description={errorMessage(query.error)}
            requestId={query.error instanceof ApiError ? query.error.requestId : undefined}
            action={<Button onClick={() => query.refetch()}>Try again</Button>}
          />
        ) : people.length === 0 ? (
          <Card>
            {filtered ? (
              <EmptyState
                icon={<SearchX />}
                title="No one matches that"
                description="Try fewer filters or a different name."
              />
            ) : (
              <EmptyState
                icon={<Users />}
                title="You’re early!"
                description="New people join every day. Check back soon."
              />
            )}
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {people.map((p) => (
                <ProfileCardView key={p.id} person={p} />
              ))}
            </div>
            {query.hasNextPage && (
              <Button
                variant="secondary"
                className="self-center"
                loading={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
              >
                Load more
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
