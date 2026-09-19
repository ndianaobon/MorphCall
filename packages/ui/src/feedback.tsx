import { AlertTriangle, Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from './cn';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-sm bg-card-elevated', className)}
      {...props}
    />
  );
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-muted', className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-10 text-center',
        className,
      )}
    >
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-card-elevated text-muted [&_svg]:size-6">
          {icon}
        </div>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-h3 font-semibold">{title}</p>
        {description && <p className="text-body-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  requestId,
  action,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  requestId?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <EmptyState
      className={className}
      icon={<AlertTriangle className="text-warning" />}
      title={title}
      description={
        <>
          {description}
          {requestId && (
            <span className="mt-1 block text-caption text-subtle">Reference: {requestId}</span>
          )}
        </>
      }
      action={action}
    />
  );
}
