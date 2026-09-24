'use client';

import type { ReportStatus } from '@morphcall/contracts';
import { CheckCircle2, Flag, PhoneCall, Users } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, cn, EmptyState, ErrorState, Skeleton } from '@morphcall/ui';
import { AdminShell } from '@/components/admin-shell';
import { ReportRow } from '@/components/report-list';
import { errorMessage } from '@/lib/api';
import { useOverview, useReports } from '@/lib/queries';

const TABS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

export default function QueuePage() {
  const [tab, setTab] = useState<ReportStatus | 'all'>('open');
  const overview = useOverview();
  const reports = useReports(tab);
  const list = reports.data?.data ?? [];

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Open reports"
            value={overview.data?.reports.open}
            hint={
              overview.data?.reports.urgent
                ? `${overview.data.reports.urgent} urgent`
                : 'none urgent'
            }
            urgent={Boolean(overview.data?.reports.urgent)}
            icon={<Flag />}
          />
          <Stat
            label="Resolved (7 days)"
            value={overview.data?.reports.resolvedLast7Days}
            icon={<CheckCircle2 />}
          />
          <Stat
            label="Live calls"
            value={overview.data?.calls.live}
            hint={`${overview.data?.calls.last24Hours ?? 0} in 24h`}
            icon={<PhoneCall />}
          />
          <Stat
            label="People"
            value={overview.data?.users.total}
            hint={`${overview.data?.users.suspended ?? 0} suspended · ${overview.data?.users.banned ?? 0} banned`}
            icon={<Users />}
          />
        </div>

        <div>
          <h1 className="text-h2 font-bold">Moderation queue</h1>
          <p className="text-body-sm text-muted">
            Urgent reports — child safety, violence, self-harm — always come first.
          </p>
        </div>

        <div
          className="flex gap-1 border-b border-border"
          role="tablist"
          aria-label="Report status"
        >
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-body-sm',
                tab === t.value
                  ? 'border-primary font-medium text-text'
                  : 'border-transparent text-muted hover:text-text',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {reports.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : reports.error ? (
          <ErrorState
            description={errorMessage(reports.error)}
            action={<Button onClick={() => reports.refetch()}>Try again</Button>}
          />
        ) : list.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCircle2 className="text-success" />}
              title={tab === 'open' ? 'Queue is clear' : 'Nothing here'}
              description={
                tab === 'open'
                  ? 'No reports waiting. New ones appear here automatically.'
                  : 'No reports with this status.'
              }
            />
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {list.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </Card>
        )}
      </div>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
  urgent,
}: {
  label: string;
  value?: number;
  hint?: string;
  icon: React.ReactNode;
  urgent?: boolean;
}) {
  return (
    <Card className={cn('flex items-center gap-3 p-4', urgent && 'border-danger/50')}>
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-md [&_svg]:size-5',
          urgent ? 'bg-danger/15 text-danger' : 'bg-primary/15 text-primary',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-caption text-muted">{label}</p>
        {value === undefined ? (
          <Skeleton className="mt-1 h-6 w-12" />
        ) : (
          <p className="tabular text-h2 leading-tight font-bold">{value}</p>
        )}
        {hint && <p className="truncate text-caption text-subtle">{hint}</p>}
      </div>
      {urgent && (
        <Badge variant="danger" className="ml-auto">
          Act now
        </Badge>
      )}
    </Card>
  );
}
