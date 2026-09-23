'use client';

import {
  CalendarDays,
  Flag,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  UserMinus,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { DropdownMenu, Tabs } from 'radix-ui';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '@morphcall/ui';
import { CallButton } from '@/components/calls/call-button';
import { BlockDialog } from '@/components/safety/block-dialog';
import { ReportDialog } from '@/components/safety/report-dialog';
import { ComingSoonButton } from '@/components/social/coming-soon-button';
import { FollowButton } from '@/components/social/follow-button';
import { ProfileCardView } from '@/components/social/profile-card';
import { ApiError, errorMessage } from '@/lib/api';
import { useConnections, useProfile } from '@/lib/queries';

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { data: p, error, isLoading, refetch } = useProfile(username);
  const [tab, setTab] = useState<'followers' | 'following'>('followers');
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  if (isLoading) return <ProfileSkeleton />;
  if (error) {
    return error instanceof ApiError && error.status === 404 ? (
      <Card>
        <EmptyState
          icon={<UserX />}
          title="This profile isn’t available"
          description="The account may not exist, or it isn’t visible to you."
          action={
            <Button variant="secondary" asChild>
              <Link href="/discover">Discover people</Link>
            </Button>
          }
        />
      </Card>
    ) : (
      <ErrorState
        description={errorMessage(error)}
        action={<Button onClick={() => refetch()}>Try again</Button>}
      />
    );
  }
  if (!p) return null;
  const isSelf = p.relationship?.isSelf ?? false;
  const joined = new Date(p.joinedAt).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <div
          className="h-28 bg-gradient-to-r from-primary/40 via-premium/30 to-ai/30 sm:h-36"
          aria-hidden
        />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <Avatar
              name={p.displayName}
              src={p.avatarUrl}
              online={p.online}
              size="xl"
              className="rounded-full ring-4 ring-card"
            />
            <div className="flex flex-wrap gap-2">
              {isSelf ? (
                <Button variant="secondary" asChild>
                  <Link href="/settings">
                    <Pencil aria-hidden /> Edit profile
                  </Link>
                </Button>
              ) : (
                <>
                  <FollowButton
                    size="md"
                    userId={p.id}
                    displayName={p.displayName}
                    following={p.relationship?.following ?? false}
                    requested={p.relationship?.followRequested ?? false}
                  />
                  <ComingSoonButton label="Message" when="coming soon" variant="secondary">
                    <MessageCircle aria-hidden /> Message
                  </ComingSoonButton>
                  <CallButton userId={p.id} displayName={p.displayName} size="md" withLabel />
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`More options for ${p.displayName}`}
                      >
                        <MoreHorizontal aria-hidden />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="end"
                        sideOffset={8}
                        className="z-50 w-52 rounded-md border border-border bg-card p-1 shadow-float"
                      >
                        <DropdownMenu.Item
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-body-sm outline-none data-[highlighted]:bg-card-elevated"
                          onSelect={() => setReportOpen(true)}
                        >
                          <Flag className="size-4 text-muted" aria-hidden /> Report
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-body-sm text-danger outline-none data-[highlighted]:bg-card-elevated"
                          onSelect={() => setBlockOpen(true)}
                        >
                          <UserMinus className="size-4" aria-hidden /> Block
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-h2 font-bold">{p.displayName}</h1>
              {p.isCreator && <Badge variant="primary">Creator</Badge>}
              {p.online && <Badge variant="success">Online</Badge>}
              {p.relationship?.followsYou && <Badge>Follows you</Badge>}
            </div>
            <p className="text-body-sm text-muted">@{p.username}</p>
          </div>
          {p.restricted ? (
            <p className="flex items-center gap-2 text-body-sm text-muted">
              <Lock className="size-4" aria-hidden /> This profile is private. Follow to see more.
            </p>
          ) : (
            p.bio && <p className="max-w-2xl text-body whitespace-pre-line">{p.bio}</p>
          )}
          {p.interests.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Interests">
              {p.interests.map((i) => (
                <li key={i.slug}>
                  <Badge variant="neutral">{i.label}</Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-5 text-body-sm">
            <button
              type="button"
              className="hover:underline"
              onClick={() => setTab('followers')}
              disabled={p.restricted}
            >
              <strong className="tabular">{p.stats.followers}</strong>{' '}
              <span className="text-muted">followers</span>
            </button>
            <button
              type="button"
              className="hover:underline"
              onClick={() => setTab('following')}
              disabled={p.restricted}
            >
              <strong className="tabular">{p.stats.following}</strong>{' '}
              <span className="text-muted">following</span>
            </button>
            <span className="flex items-center gap-1 text-muted">
              <CalendarDays className="size-4" aria-hidden /> Joined {joined}
            </span>
          </div>
        </div>
      </Card>

      <BlockDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        user={{ id: p.id, displayName: p.displayName }}
      />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        target={{ type: 'user', id: p.id, name: p.displayName }}
      />

      {!p.restricted && (
        <Tabs.Root
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex flex-col gap-4"
        >
          <Tabs.List aria-label="Connections" className="flex gap-1 border-b border-border">
            {(['followers', 'following'] as const).map((t) => (
              <Tabs.Trigger
                key={t}
                value={t}
                className="-mb-px border-b-2 border-transparent px-3 py-2 text-body-sm text-muted capitalize data-[state=active]:border-primary data-[state=active]:text-text"
              >
                {t}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value="followers">
            <Connections userId={p.id} direction="followers" />
          </Tabs.Content>
          <Tabs.Content value="following">
            <Connections userId={p.id} direction="following" />
          </Tabs.Content>
        </Tabs.Root>
      )}
    </div>
  );
}

function Connections({
  userId,
  direction,
}: {
  userId: string;
  direction: 'followers' | 'following';
}) {
  const q = useConnections(userId, direction);
  const people = q.data?.pages.flatMap((p) => p.data) ?? [];
  if (q.isLoading) return <Skeleton className="h-40" />;
  if (people.length === 0) {
    return (
      <p className="py-6 text-center text-body-sm text-muted">
        {direction === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((c) => (
          <ProfileCardView key={c.id} person={c} />
        ))}
      </div>
      {q.hasNextPage && (
        <Button
          variant="secondary"
          className="self-center"
          loading={q.isFetchingNextPage}
          onClick={() => q.fetchNextPage()}
        >
          Load more
        </Button>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <Card className="overflow-hidden" aria-busy="true">
      <Skeleton className="h-36 rounded-none" />
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="-mt-16 size-24 rounded-full" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full max-w-xl" />
      </div>
    </Card>
  );
}
