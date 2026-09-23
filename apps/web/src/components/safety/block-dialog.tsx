'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@morphcall/ui';
import { errorMessage } from '@/lib/api';
import { useBlockUser } from '@/lib/call-queries';

export function BlockDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; displayName: string };
}) {
  const router = useRouter();
  const block = useBlockUser();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Block {user.displayName}?</DialogTitle>
        <DialogDescription>
          They won’t be able to find you, message you or call you, and you won’t see them either.
          Any call between you ends right away. You can unblock them in Settings.
        </DialogDescription>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={block.isPending}
            onClick={() =>
              block.mutate(
                { userId: user.id },
                {
                  onSuccess: () => {
                    toast.success(`${user.displayName} is blocked.`);
                    onOpenChange(false);
                    router.replace('/discover');
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                },
              )
            }
          >
            Block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
