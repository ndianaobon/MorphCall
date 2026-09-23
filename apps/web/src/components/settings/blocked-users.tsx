'use client';

import { toast } from 'sonner';
import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@morphcall/ui';
import { errorMessage } from '@/lib/api';
import { useBlockedUsers, useUnblockUser } from '@/lib/call-queries';

export function BlockedUsersSection() {
  const blocked = useBlockedUsers();
  const unblock = useUnblockUser();
  const list = blocked.data ?? [];

  return (
    <Card id="blocked">
      <CardHeader>
        <div>
          <CardTitle>Blocked people</CardTitle>
          <CardDescription>
            Blocked people can’t find, message or call you — and you won’t see them either.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {blocked.isLoading ? (
          <Skeleton className="h-12" />
        ) : list.length === 0 ? (
          <p className="text-body-sm text-muted">You haven’t blocked anyone.</p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((user) => (
              <li key={user.id} className="flex items-center gap-3 py-3">
                <Avatar name={user.displayName ?? user.username} src={user.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium">{user.displayName}</p>
                  <p className="truncate text-caption text-muted">@{user.username}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={unblock.isPending}
                  onClick={() =>
                    unblock.mutate(user.id, {
                      onSuccess: () => toast.success(`${user.displayName} is unblocked.`),
                      onError: (err) => toast.error(errorMessage(err)),
                    })
                  }
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
