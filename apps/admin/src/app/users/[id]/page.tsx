'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  Skeleton,
} from '@morphcall/ui';
import { AdminShell } from '@/components/admin-shell';
import { ModerationActions } from '@/components/moderation-actions';
import { errorMessage } from '@/lib/api';
import { useAdminMe, useAdminUser } from '@/lib/queries';

export default function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: me } = useAdminMe();
  const user = useAdminUser(id);

  return (
    <AdminShell>
      <div className="flex flex-col gap-5">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/users">
            <ArrowLeft aria-hidden /> Back to people
          </Link>
        </Button>

        {user.isLoading ? (
          <Skeleton className="h-64" />
        ) : user.error ? (
          <ErrorState description={errorMessage(user.error)} />
        ) : user.data ? (
          <>
            <Card>
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar
                    name={user.data.displayName ?? user.data.email}
                    src={user.data.avatarUrl}
                    size="xl"
                  />
                  <div className="min-w-0 flex-1">
                    <h1 className="text-h2 font-bold">{user.data.displayName ?? '(no profile)'}</h1>
                    <p className="text-body-sm text-muted">
                      {user.data.username ? `@${user.data.username} · ` : ''}
                      {user.data.email}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant={user.data.status === 'active' ? 'success' : 'warning'}>
                        {user.data.status}
                      </Badge>
                      <Badge
                        variant={
                          user.data.premiumStatus === 'PREMIUM_ACTIVE' ? 'premium' : 'neutral'
                        }
                      >
                        {user.data.premiumStatus.replace('_', ' ').toLowerCase()}
                      </Badge>
                      {user.data.countryCode && <Badge>{user.data.countryCode}</Badge>}
                    </div>
                  </div>
                  {me && <ModerationActions user={user.data} role={me.role} />}
                </div>

                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat
                    label="Reports against"
                    value={user.data.reportsAgainst}
                    warn={user.data.reportsAgainst > 2}
                  />
                  <Stat label="Reports filed" value={user.data.reportsFiled} />
                  <Stat label="Calls (30 days)" value={user.data.callsLast30Days} />
                  <Stat label="Followers" value={user.data.followers} />
                </dl>
                <p className="text-caption text-subtle">
                  Joined {new Date(user.data.createdAt).toLocaleString()}
                  {user.data.lastSeenAt
                    ? ` · last seen ${new Date(user.data.lastSeenAt).toLocaleString()}`
                    : ' · never signed in'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Moderation history</CardTitle>
              </CardHeader>
              <CardContent>
                {user.data.history.length === 0 ? (
                  <p className="text-body-sm text-muted">
                    No actions have been taken on this account.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {user.data.history.map((h) => (
                      <li
                        key={h.id}
                        className="flex flex-wrap items-center gap-2 py-3 text-body-sm"
                      >
                        <Badge variant={h.revokedAt ? 'neutral' : 'warning'}>{h.action}</Badge>
                        <span className="min-w-0 flex-1 truncate">{h.reason}</span>
                        <span className="text-caption text-subtle">
                          {new Date(h.createdAt).toLocaleString()}
                          {h.expiresAt ? ` → ${new Date(h.expiresAt).toLocaleDateString()}` : ''}
                          {h.revokedAt ? ' · lifted' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-md border border-border p-3">
      <dt className="text-caption text-muted">{label}</dt>
      <dd className={`tabular text-h3 font-semibold ${warn ? 'text-danger' : ''}`}>{value}</dd>
    </div>
  );
}
