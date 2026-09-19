import { Injectable } from '@nestjs/common';
import { StorageUrls } from '../social/storage-urls.js';

/** Confirms an avatar object really exists before we point a profile at it. */
@Injectable()
export class AvatarStore {
  constructor(private readonly urls: StorageUrls) {}

  async exists(path: string): Promise<boolean> {
    const url = this.urls.avatar(path);
    if (!url) return false;
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
