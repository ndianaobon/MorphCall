'use client';

import { ArrowRight, Compass, Crown, ScanFace, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@morphcall/ui';
import { IllustratedFace } from '@/components/marketing/call-preview';
import { ProfileCardSkeleton, ProfileCardView } from '@/components/social/profile-card';
import { useDiscover, useFollowRequests, useMe } from '@/lib/queries';

export default function HomePage() {
  const { data: me } = useMe();
  const recommended = useDiscover({ limit: 6 });
  const online = useDiscover({ online: true, limit: 6 });
  const requests = useFollowRequests();
  const people = recommended.data?.pages[0]?.data ?? [];
  const onlinePeople = online.data?.pages[0]?.data ?? [];
  const name = me?.profile?.displayName.split(' ')[0] ?? 'there';

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        {/* Hero */}
        <Card className="relative overflow-hidden border-primary/40">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-primary/20 blur-3xl"
          />
          <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex flex-col gap-3">
              <h1 className="text-h1 font-bold">Welcome back, {name}</h1>
              <p className="max-w-lg text-body text-muted">
                Connect. Call. Become Anyone. Find people who share your interests — video calls
                arrive in the next update.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/discover">
                    <Compass aria-hidden /> Discover people
                  </Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link href={`/u/${me?.profile?.username ?? ''}`}>View my profile</Link>
                </Button>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex" aria-hidden>
              <div className="w-24 overflow-hidden rounded-md border border-border">
                <div className="aspect-[4/5]">
                  <IllustratedFace hue={215} variant="a" />
                </div>
              </div>
              <ArrowRight className="size-4 text-ai" />
              <div className="relative w-24 overflow-hidden rounded-md border border-ai/50">
                <div className="aspect-[4/5]">
                  <IllustratedFace hue={290} variant="b" />
                </div>
                <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] font-semibold text-ai">
                  AI
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Recommended people */}
        <section aria-labelledby="recommended-heading" className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 id="recommended-heading" className="text-h3 font-semibold">
                Recommended people
              </h2>
              <p className="text-caption text-muted">
                People you might like — based on your interests
              </p>
            </div>
            <Button variant="link" asChild>
              <Link href="/discover">See all</Link>
            </Button>
          </div>
          {recommended.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <ProfileCardSkeleton key={i} />
              ))}
            </div>
          ) : people.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Users />}
                title="You’re early!"
                description="No one else matches yet. Invite friends, or check back soon — new people join every day."
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {people.slice(0, 6).map((p) => (
                <ProfileCardView key={p.id} person={p} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Right rail */}
      <aside className="flex flex-col gap-4" aria-label="Activity">
        <Card>
          <CardHeader>
            <CardTitle className="text-body font-semibold">Online now</CardTitle>
          </CardHeader>
          <CardContent>
            {online.isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : onlinePeople.length === 0 ? (
              <p className="text-body-sm text-muted">Nobody you can see is online right now.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {onlinePeople.map((p) => (
                  <li key={p.id}>
                    <Link href={`/u/${p.username}`} className="flex items-center gap-3 rounded-sm">
                      <Avatar name={p.displayName} src={p.avatarUrl} online={p.online} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-medium">
                          {p.displayName}
                        </span>
                        <span className="block truncate text-caption text-muted">
                          @{p.username}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {(requests.data?.data.length ?? 0) > 0 && (
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <p className="text-body-sm">
                <strong>{requests.data!.data.length}</strong> follow request
                {requests.data!.data.length === 1 ? '' : 's'}
              </p>
              <Button size="sm" variant="secondary" asChild>
                <Link href="/notifications">Review</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-premium/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-body font-semibold">
              <Crown className="size-4 text-premium" aria-hidden /> Premium
            </CardTitle>
            <Badge variant="premium">
              <Sparkles aria-hidden /> AI
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-body-sm text-muted">
              Unlock AI identities, voice transformation and priority support.
            </p>
            <div className="grid grid-cols-2 gap-2 text-body-sm">
              <div className="rounded-sm border border-border p-2">
                <p className="text-caption text-muted">Monthly</p>
                <p className="tabular font-semibold">$9.99</p>
              </div>
              <div className="rounded-sm border border-border p-2">
                <p className="text-caption text-muted">Annual</p>
                <p className="tabular font-semibold">$99.99</p>
              </div>
            </div>
            <Button variant="premium" asChild>
              <Link href="/premium">
                <ScanFace aria-hidden /> See Premium
              </Link>
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
