import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';

export const AVATAR_BUCKET = 'avatars';

@Injectable()
export class StorageUrls {
  constructor(@Inject(ENV) private readonly env: Env) {}

  avatar(path: string | null): string | null {
    return path
      ? `${this.env.SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`
      : null;
  }
}
