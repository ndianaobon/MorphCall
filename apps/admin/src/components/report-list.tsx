'use client';

import type { ReportListItem } from '@morphcall/contracts';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Avatar, Badge, cn } from '@morphcall/ui';

const REASON_LABELS: Record<string, string> = {
  harassment: 'Harassment',
  hate: 'Hate speech',
  sexual_content: 'Sexual content',
  minor_safety: 'Child safety',
  impersonation: 'Impersonation',
  deepfake_misuse: 'AI misuse',
  scam: 'Scam',
  spam: 'Spam',
  violence: 'Violence',
  self_harm: 'Self-harm',
  other: 'Other',
};

export function ReportRow({ report }: { report: ReportListItem }) {
  const urgent = report.priority === 1;
  const target = report.target;
  return (
    <Link
      href={`/reports/${report.id}`}
      className="flex items-center gap-3 p-4 transition-colors hover:bg-card-elevated"
    >
      <div
        className={cn('w-1 self-stretch rounded-full', urgent ? 'bg-danger' : 'bg-transparent')}
        aria-hidden
      />
      <Avatar
        name={target?.displayName ?? target?.username ?? 'Unknown'}
        src={target?.avatarUrl ?? null}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-body-sm font-semibold">
            {target?.displayName ?? 'Unknown account'}
          </span>
          {target?.username && <span className="text-caption text-muted">@{target.username}</span>}
          {urgent && (
            <Badge variant="danger">
              <AlertTriangle aria-hidden /> Urgent
            </Badge>
          )}
          {target?.status !== 'active' && target && (
            <Badge variant="warning">{target.status}</Badge>
          )}
          {report.priorReports > 1 && <Badge>{report.priorReports} reports</Badge>}
        </div>
        <p className="truncate text-caption text-muted">
          {REASON_LABELS[report.reason] ?? report.reason}
          {report.details ? ` — ${report.details}` : ''}
        </p>
      </div>
      <div className="hidden text-right text-caption text-muted sm:block">
        <p>
          {new Date(report.createdAt).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
          })}
        </p>
        <p>
          {new Date(report.createdAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
      <Badge variant={report.status === 'open' ? 'primary' : 'neutral'}>
        {report.status.replace('_', ' ')}
      </Badge>
      <ChevronRight className="size-4 text-subtle" aria-hidden />
    </Link>
  );
}

export { REASON_LABELS };
