'use client';

import { type ReportReason, REPORT_REASONS } from '@morphcall/contracts';
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
  OptionCards,
  Textarea,
} from '@morphcall/ui';
import { errorMessage } from '@/lib/api';
import { useReport } from '@/lib/call-queries';

const REASON_LABELS: Record<ReportReason, { label: string; description?: string }> = {
  harassment: { label: 'Harassment or bullying' },
  hate: { label: 'Hate speech' },
  sexual_content: { label: 'Sexual content' },
  minor_safety: { label: 'Child safety', description: 'Reviewed first' },
  impersonation: { label: 'Pretending to be someone' },
  deepfake_misuse: { label: 'Misuse of AI identity or voice' },
  scam: { label: 'Scam or fraud' },
  spam: { label: 'Spam' },
  violence: { label: 'Violence or threats', description: 'Reviewed first' },
  self_harm: { label: 'Self-harm', description: 'Reviewed first' },
  other: { label: 'Something else' },
};

export function ReportDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: { type: 'user' | 'call'; id: string; name: string };
}) {
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');
  const report = useReport();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Report {target.type === 'call' ? 'this call' : target.name}</DialogTitle>
        <DialogDescription>
          Reports go to our moderation team. We never tell the other person who reported them.
        </DialogDescription>
        <div className="max-h-[50vh] overflow-y-auto pr-1">
          <OptionCards
            aria-label="Reason for reporting"
            className="sm:grid-cols-2"
            value={reason}
            onValueChange={setReason}
            options={REPORT_REASONS.map((r) => ({ value: r, ...REASON_LABELS[r] }))}
          />
          <Field
            id="report-details"
            label="Anything else? (optional)"
            className="mt-4"
            hint={`${details.length}/2000`}
          >
            {(a) => (
              <Textarea
                {...a}
                maxLength={2000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="What happened?"
              />
            )}
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={report.isPending}
            onClick={() =>
              report.mutate(
                {
                  targetType: target.type,
                  targetId: target.id,
                  reason,
                  details: details.trim() || undefined,
                },
                {
                  onSuccess: () => {
                    toast.success('Report sent. Thank you — our team will review it.');
                    onOpenChange(false);
                    setDetails('');
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                },
              )
            }
          >
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
