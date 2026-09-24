'use client';

import { AlertTriangle, ArrowLeft, Check, Clock, X } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { toast } from 'sonner';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  Skeleton,
  Textarea,
} from '@morphcall/ui';
import { AdminShell } from '@/components/admin-shell';
import { ModerationActions } from '@/components/moderation-actions';
import { REASON_LABELS } from '@/components/report-list';
import { errorMessage } from '@/lib/api';
import { useAdminMe, useAdminUser, useReport, useUpdateReport } from '@/lib/queries';

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: me } = useAdminMe();
  const report = useReport(id);
  const targetId = report.data?.target?.id;
  const user = useAdminUser(targetId ?? '');
  const update = useUpdateReport(id);
  const [note, setNote] = useState('');

  return (
    <AdminShell>
      <div className="flex flex-col gap-5">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/">
            <ArrowLeft aria-hidden /> Back to queue
          </Link>
        </Button>

        {report.isLoading ? (
          <Skeleton className="h-64" />
        ) : report.error ? (
          <ErrorState description={errorMessage(report.error)} />
        ) : report.data ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>
                      {REASON_LABELS[report.data.reason] ?? report.data.reason}
                      {report.data.priority === 1 && (
                        <Badge variant="danger" className="ml-2">
                          <AlertTriangle aria-hidden /> Urgent
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-caption text-muted">
                      Reported {new Date(report.data.createdAt).toLocaleString()} · about a{' '}
                      {report.data.targetType}
                    </p>
                  </div>
                  <Badge variant={report.data.status === 'open' ? 'primary' : 'neutral'}>
                    {report.data.status.replace('_', ' ')}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {report.data.details ? (
                    <blockquote className="rounded-md border border-border bg-bg p-3 text-body-sm whitespace-pre-line">
                      {report.data.details}
                    </blockquote>
                  ) : (
                    <p className="text-body-sm text-muted">No extra detail was given.</p>
                  )}

                  {report.data.context && (
                    <div className="rounded-md border border-border p-3 text-body-sm">
                      <p className="mb-1 font-semibold">Call details</p>
                      <dl className="grid grid-cols-2 gap-1 text-caption text-muted">
                        {Object.entries(report.data.context)
                          .filter(([k]) => k !== 'kind')
                          .map(([k, v]) => (
                            <div key={k} className="contents">
                              <dt className="capitalize">{k.replace(/([A-Z])/g, ' $1')}</dt>
                              <dd className="text-text">
                                {Array.isArray(v) ? v.join(', ') : String(v ?? '—')}
                              </dd>
                            </div>
                          ))}
                      </dl>
                      <p className="mt-2 text-caption text-subtle">
                        Calls are never recorded — this is metadata only.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-body-sm">
                    <span className="text-muted">Reported by</span>
                    {report.data.reporter ? (
                      <Link
                        href={`/users/${report.data.reporter.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Avatar
                          name={report.data.reporter.displayName ?? 'User'}
                          src={report.data.reporter.avatarUrl}
                          size="xs"
                        />
                        {report.data.reporter.displayName ?? report.data.reporter.username}
                      </Link>
                    ) : (
                      <span className="text-subtle">Deleted account</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Decision</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Field
                    id="note"
                    label="Resolution note"
                    hint="Stored with the report and the audit log."
                  >
                    {(a) => (
                      <Textarea
                        {...a}
                        maxLength={1000}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What did you decide, and why?"
                      />
                    )}
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={update.isPending}
                      onClick={() =>
                        update.mutate(
                          { assignToMe: true, status: 'in_review' },
                          { onSuccess: () => toast.success('Assigned to you.') },
                        )
                      }
                    >
                      <Clock aria-hidden /> Take this case
                    </Button>
                    <Button
                      size="sm"
                      loading={update.isPending}
                      onClick={() =>
                        update.mutate(
                          { status: 'resolved', resolutionNote: note.trim() || undefined },
                          { onSuccess: () => toast.success('Marked resolved.') },
                        )
                      }
                    >
                      <Check aria-hidden /> Resolve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={update.isPending}
                      onClick={() =>
                        update.mutate(
                          { status: 'dismissed', resolutionNote: note.trim() || undefined },
                          { onSuccess: () => toast.success('Dismissed.') },
                        )
                      }
                    >
                      <X aria-hidden /> Dismiss
                    </Button>
                  </div>
                  {report.data.resolutionNote && (
                    <p className="text-caption text-muted">
                      Previous note: {report.data.resolutionNote}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* The person being reported */}
            <aside className="flex flex-col gap-4">
              {user.data ? (
                <Card>
                  <CardContent className="flex flex-col gap-3 p-4">
                    <Link href={`/users/${user.data.id}`} className="flex items-center gap-3">
                      <Avatar
                        name={user.data.displayName ?? 'User'}
                        src={user.data.avatarUrl}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{user.data.displayName}</p>
                        <p className="truncate text-caption text-muted">@{user.data.username}</p>
                        <Badge
                          variant={user.data.status === 'active' ? 'success' : 'warning'}
                          className="mt-1"
                        >
                          {user.data.status}
                        </Badge>
                      </div>
                    </Link>
                    <dl className="grid grid-cols-2 gap-2 text-caption">
                      <Stat
                        label="Reports against"
                        value={user.data.reportsAgainst}
                        warn={user.data.reportsAgainst > 2}
                      />
                      <Stat label="Reports filed" value={user.data.reportsFiled} />
                      <Stat label="Calls (30d)" value={user.data.callsLast30Days} />
                      <Stat label="Followers" value={user.data.followers} />
                    </dl>
                    <p className="text-caption text-subtle">
                      Joined {new Date(user.data.createdAt).toLocaleDateString()} ·{' '}
                      {user.data.premiumStatus}
                    </p>
                    {me && <ModerationActions user={user.data} role={me.role} reportId={id} />}
                  </CardContent>
                </Card>
              ) : (
                <Skeleton className="h-64" />
              )}

              {report.data.history.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-body">Past actions</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {report.data.history.map((h) => (
                      <div key={h.id} className="rounded-sm border border-border p-2 text-caption">
                        <p className="font-medium text-text">
                          {h.action}
                          {h.revokedAt && <span className="ml-1 text-muted">(lifted)</span>}
                        </p>
                        <p className="text-muted">{h.reason}</p>
                        <p className="text-subtle">{new Date(h.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </aside>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-sm border border-border p-2">
      <dt className="text-muted">{label}</dt>
      <dd className={`tabular text-body font-semibold ${warn ? 'text-danger' : ''}`}>{value}</dd>
    </div>
  );
}
