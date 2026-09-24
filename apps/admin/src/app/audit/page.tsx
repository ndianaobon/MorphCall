'use client';

import { Card, EmptyState, ErrorState, Skeleton } from '@morphcall/ui';
import { AdminShell } from '@/components/admin-shell';
import { errorMessage } from '@/lib/api';
import { useAuditLog } from '@/lib/queries';

export default function AuditPage() {
  const log = useAuditLog();
  const entries = log.data?.data ?? [];

  return (
    <AdminShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-h2 font-bold">Audit log</h1>
          <p className="text-body-sm text-muted">
            Every staff action, in order. This record can’t be edited or deleted.
          </p>
        </div>

        {log.isLoading ? (
          <Skeleton className="h-64" />
        ) : log.error ? (
          <ErrorState description={errorMessage(log.error)} />
        ) : entries.length === 0 ? (
          <Card>
            <EmptyState title="Nothing logged yet" description="Staff actions will appear here." />
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center gap-2 p-3 text-body-sm">
                <code className="rounded-sm bg-card-elevated px-1.5 py-0.5 text-caption">
                  {entry.action}
                </code>
                <span className="text-muted">{entry.admin.email ?? entry.admin.id}</span>
                <span className="min-w-0 flex-1 truncate text-caption text-subtle">
                  {entry.targetType} {entry.targetId}
                  {entry.reason ? ` — ${entry.reason}` : ''}
                </span>
                <time className="text-caption text-subtle" dateTime={entry.createdAt}>
                  {new Date(entry.createdAt).toLocaleString()}
                </time>
              </div>
            ))}
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
