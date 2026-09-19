'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@morphcall/ui';
import { errorMessage } from '@/lib/api';
import { useFollowRequests, useRespondToRequest } from '@/lib/queries';

export default function NotificationsPage() {
  const requests = useFollowRequests();
  const respond = useRespondToRequest();
  const list = requests.data?.data ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-h1 font-bold">Notifications</h1>

      <Card>
        <CardHeader>
          <CardTitle>Follow requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.isLoading ? (
            <Skeleton className="h-16" />
          ) : list.length === 0 ? (
            <p className="text-body-sm text-muted">
              No pending requests. People ask to follow you when your profile is private.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <Link
                    href={`/u/${p.username}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <Avatar name={p.displayName} src={p.avatarUrl} />
                    <span className="min-w-0">
                      <span className="block truncate text-body-sm font-semibold">
                        {p.displayName}
                      </span>
                      <span className="block truncate text-caption text-muted">@{p.username}</span>
                    </span>
                  </Link>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        respond.mutate(
                          { followerId: p.id, accept: true },
                          {
                            onSuccess: () =>
                              toast.success(`${p.displayName} can now see your profile.`),
                            onError: (e) => toast.error(errorMessage(e)),
                          },
                        )
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        respond.mutate(
                          { followerId: p.id, accept: false },
                          { onError: (e) => toast.error(errorMessage(e)) },
                        )
                      }
                    >
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <EmptyState
          icon={<Bell />}
          title="Activity is coming soon"
          description="New followers, messages, missed calls and live streams will show up here."
        />
      </Card>
    </div>
  );
}
