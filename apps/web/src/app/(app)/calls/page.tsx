'use client';

import type { CallHistoryQuery, CallSummary } from '@morphcall/contracts';
import { PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar, Badge, Button, Card, cn, EmptyState, ErrorState, Skeleton } from '@morphcall/ui';
import { CallButton } from '@/components/calls/call-button';
import { errorMessage } from '@/lib/api';
import { useCallHistory } from '@/lib/call-queries';

const FILTERS: { value: CallHistoryQuery['filter']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'missed', label: 'Missed' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'outgoing', label: 'Outgoing' },
];

export default function CallsPage() {
  const [filter, setFilter] = useState<CallHistoryQuery['filter']>('all');
  const query = useCallHistory(filter);
  const calls = query.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-h1 font-bold">Calls</h1>
        <p className="text-body-sm text-muted">Your recent video calls.</p>
      </div>

      <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Filter calls">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-body-sm',
              filter === f.value
                ? 'border-primary font-medium text-text'
                : 'border-transparent text-muted hover:text-text',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : query.error ? (
        <ErrorState
          description={errorMessage(query.error)}
          action={<Button onClick={() => query.refetch()}>Try again</Button>}
        />
      ) : calls.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PhoneOff />}
            title="No calls yet"
            description="Find someone to talk to and your calls will show up here."
            action={
              <Button variant="secondary" asChild>
                <Link href="/discover">Discover people</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {calls.map((call) => (
            <CallRow key={call.id} call={call} />
          ))}
        </Card>
      )}

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
  );
}

function CallRow({ call }: { call: CallSummary }) {
  const missed =
    call.status === 'missed' || (call.status === 'declined' && call.direction === 'incoming');
  const Icon = missed ? PhoneMissed : call.direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;
  const when = new Date(call.startedAt);

  return (
    <div className="flex items-center gap-3 p-4">
      <Link href={`/u/${call.peer.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={call.peer.displayName} src={call.peer.avatarUrl} />
        <span className="min-w-0">
          <span className="block truncate text-body-sm font-semibold">{call.peer.displayName}</span>
          <span
            className={cn(
              'flex items-center gap-1.5 text-caption',
              missed ? 'text-danger' : 'text-muted',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {missed
              ? 'Missed'
              : call.status === 'canceled'
                ? 'Cancelled'
                : call.durationSeconds
                  ? formatDuration(call.durationSeconds)
                  : 'No answer'}
            <span aria-hidden>·</span>
            <time dateTime={call.startedAt}>
              {when.toLocaleString(undefined, {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </span>
        </span>
      </Link>
      {call.endReason === 'blocked' && <Badge variant="warning">Blocked</Badge>}
      <CallButton userId={call.peer.id} displayName={call.peer.displayName} />
    </div>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
