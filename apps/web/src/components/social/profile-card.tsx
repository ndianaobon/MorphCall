'use client';

import { MessageCircle, Video } from 'lucide-react';
import Link from 'next/link';
import type { ProfileCard as Card } from '@morphcall/contracts';
import { Avatar, Badge, Skeleton } from '@morphcall/ui';
import { useInterests } from '@/lib/queries';
import { ComingSoonButton } from './coming-soon-button';
import { FollowButton } from './follow-button';

export function ProfileCardView({ person }: { person: Card }) {
  const { data: interests } = useInterests();
  const label = (slug: string) => interests?.find((i) => i.slug === slug)?.label ?? slug;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong">
      <Link href={`/u/${person.username}`} className="flex items-center gap-3 rounded-sm">
        <Avatar name={person.displayName} src={person.avatarUrl} online={person.online} size="lg" />
        <div className="min-w-0">
          <h3 className="truncate text-body font-semibold">{person.displayName}</h3>
          <p className="truncate text-caption text-muted">@{person.username}</p>
          {person.online && (
            <Badge variant="success" className="mt-1">
              Online
            </Badge>
          )}
        </div>
      </Link>
      <p className="line-clamp-2 min-h-10 text-body-sm text-muted">
        {person.bio ?? <span className="text-subtle">No bio yet</span>}
      </p>
      {person.interests.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Interests">
          {person.interests.slice(0, 3).map((slug) => (
            <li key={slug}>
              <Badge>{label(slug)}</Badge>
            </li>
          ))}
          {person.interests.length > 3 && (
            <li>
              <Badge>+{person.interests.length - 3}</Badge>
            </li>
          )}
        </ul>
      )}
      <div className="mt-auto flex items-center gap-2 pt-1">
        <FollowButton
          userId={person.id}
          displayName={person.displayName}
          following={person.following}
          requested={person.followRequested}
        />
        <ComingSoonButton label="Message" when="coming soon" variant="secondary" size="icon-sm">
          <MessageCircle aria-hidden />
        </ComingSoonButton>
        <ComingSoonButton
          label="Video call"
          when="coming in the next update"
          variant="secondary"
          size="icon-sm"
        >
          <Video aria-hidden />
        </ComingSoonButton>
      </div>
    </article>
  );
}

export function ProfileCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-10" />
      <Skeleton className="h-8 w-1/2" />
    </div>
  );
}
