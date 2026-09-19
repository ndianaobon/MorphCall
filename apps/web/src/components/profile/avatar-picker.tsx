'use client';

import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, Button } from '@morphcall/ui';
import { errorMessage } from '@/lib/api';
import { AvatarError, prepareAvatar, uploadAvatar } from '@/lib/avatar-upload';
import { useRemoveAvatar, useSetAvatar } from '@/lib/queries';

export function AvatarPicker({
  userId,
  name,
  src,
}: {
  userId: string;
  name: string;
  src: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const setAvatar = useSetAvatar();
  const removeAvatar = useRemoveAvatar();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await prepareAvatar(file);
      const path = await uploadAvatar(userId, blob);
      await setAvatar.mutateAsync(path);
      toast.success('Profile photo updated.');
    } catch (err) {
      toast.error(err instanceof AvatarError ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-5">
      <Avatar name={name} src={src} size="xl" />
      <div className="flex flex-col gap-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          id="avatar-file"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            onClick={() => input.current?.click()}
          >
            {!busy && <Camera aria-hidden />}
            {src ? 'Change photo' : 'Upload photo'}
          </Button>
          {src && (
            <Button
              type="button"
              variant="ghost"
              loading={removeAvatar.isPending}
              onClick={() => removeAvatar.mutate()}
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          )}
        </div>
        <p className="text-caption text-muted">
          JPG, PNG or WebP, up to 10 MB. We crop it to a square.
        </p>
      </div>
    </div>
  );
}
