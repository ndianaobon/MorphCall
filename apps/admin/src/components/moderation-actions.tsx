'use client';

import type { AdminUserDetail, ModerationAction, StaffRole } from '@morphcall/contracts';
import { Ban, Gavel, ShieldOff, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Field,
  Input,
  Textarea,
} from '@morphcall/ui';
import { errorMessage } from '@/lib/api';
import { useModerateUser } from '@/lib/queries';

const ACTION_COPY: Record<
  ModerationAction,
  { label: string; title: string; description: string; destructive?: boolean }
> = {
  warn: {
    label: 'Warn',
    title: 'Send a warning',
    description: 'They keep full access but receive a notice explaining the problem.',
  },
  suspend: {
    label: 'Suspend',
    title: 'Suspend this account',
    description:
      'They are signed out of calls immediately and cannot use MorphCall until the suspension lifts.',
    destructive: true,
  },
  ban: {
    label: 'Ban',
    title: 'Ban this account permanently',
    description: 'Live calls end at once and the account is closed. Admins only.',
    destructive: true,
  },
  unban: {
    label: 'Restore',
    title: 'Restore this account',
    description: 'Access returns and the earlier suspension or ban is marked as lifted.',
  },
  ai_access_revoked: {
    label: 'Revoke AI',
    title: 'Revoke AI features',
    description: 'They keep their account but lose AI identity and voice, even with Premium.',
    destructive: true,
  },
  content_removed: {
    label: 'Remove content',
    title: 'Record a content removal',
    description: 'Logs that content was taken down as part of this case.',
  },
};

export function ModerationActions({
  user,
  role,
  reportId,
}: {
  user: AdminUserDetail;
  role: StaffRole;
  reportId?: string;
}) {
  const [open, setOpen] = useState<ModerationAction | null>(null);
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const moderate = useModerateUser(user.id);

  const canBan = role === 'admin' || role === 'super_admin';
  const restricted = user.status === 'suspended' || user.status === 'banned';
  const available: ModerationAction[] = restricted
    ? ['unban', 'warn']
    : ['warn', 'suspend', 'ban', 'ai_access_revoked'];

  const copy = open ? ACTION_COPY[open] : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {available.map((action) => {
          const disabled = (action === 'ban' || action === 'unban') && !canBan;
          const Icon =
            action === 'ban'
              ? Ban
              : action === 'unban'
                ? UserCheck
                : action === 'warn'
                  ? Gavel
                  : ShieldOff;
          return (
            <Button
              key={action}
              size="sm"
              variant={ACTION_COPY[action].destructive ? 'destructive' : 'secondary'}
              disabled={disabled}
              title={disabled ? 'Admins only' : undefined}
              onClick={() => {
                setReason('');
                setExpiresAt('');
                setOpen(action);
              }}
            >
              <Icon aria-hidden /> {ACTION_COPY[action].label}
            </Button>
          );
        })}
      </div>

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>{copy?.description}</DialogDescription>
          <Field
            id="reason"
            label="Reason (kept in the audit log)"
            hint="Say what happened and which rule it breaks."
          >
            {(a) => (
              <Textarea
                {...a}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Repeated harassment in calls after a warning on 12 Sep."
              />
            )}
          </Field>
          {open === 'suspend' && (
            <Field
              id="expires"
              label="Until (optional)"
              hint="Leave empty for an indefinite suspension."
            >
              {(a) => (
                <Input
                  {...a}
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              )}
            </Field>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              variant={copy?.destructive ? 'destructive' : 'primary'}
              loading={moderate.isPending}
              disabled={reason.trim().length < 3}
              onClick={() =>
                moderate.mutate(
                  {
                    action: open!,
                    reason: reason.trim(),
                    ...(open === 'suspend' && expiresAt
                      ? { expiresAt: new Date(expiresAt).toISOString() }
                      : {}),
                    ...(reportId ? { reportId } : {}),
                  },
                  {
                    onSuccess: () => {
                      toast.success(`${copy?.label} applied.`);
                      setOpen(null);
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  },
                )
              }
            >
              {copy?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
