import { supabaseBrowser } from './supabase/client';

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const OUTPUT_SIZE = 512;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export class AvatarError extends Error {}

/**
 * Center-crops to a 512×512 WebP in the browser. Re-encoding through a canvas also strips
 * EXIF metadata (location, device) before anything leaves the device.
 */
export async function prepareAvatar(file: File): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) throw new AvatarError('Use a JPG, PNG or WebP image.');
  if (file.size > MAX_INPUT_BYTES) throw new AvatarError('That image is over 10 MB.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarError('We couldn’t read that image. Try another one.');
  }
  if (bitmap.width < 128 || bitmap.height < 128) {
    throw new AvatarError('That image is too small — use at least 128×128 pixels.');
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.9),
  );
  if (!blob) throw new AvatarError('We couldn’t process that image.');
  return blob;
}

/** Uploads into avatars/<userId>/<uuid>.webp (storage policy only allows the user's own folder). */
export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabaseBrowser()
    .storage.from('avatars')
    .upload(path, blob, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
  if (error) throw new AvatarError('Upload failed. Please try again.');
  return path;
}
