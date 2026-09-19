import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { profiles, users } from '../db/schema.js';
import type { AuthContext } from './auth-context.js';
import type { VerifiedToken } from './jwt-verifier.js';

const LAST_SEEN_WRITE_INTERVAL_MS = 60_000;

/** Loads the server-side account state for a verified token (never trusts token claims for it). */
@Injectable()
export class AccountContextService {
  private readonly lastSeenWrites = new Map<string, number>();

  constructor(@Inject(DB) private readonly db: Db) {}

  async load(token: VerifiedToken): Promise<AuthContext | null> {
    const [row] = await this.db
      .select({
        userId: users.id,
        email: users.email,
        status: users.status,
        dateOfBirth: users.dateOfBirth,
        countryCode: users.countryCode,
        onboardedAt: profiles.onboardedAt,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, token.userId))
      .limit(1);
    if (!row) return null;

    this.touchLastSeen(row.userId);
    return {
      userId: row.userId,
      email: row.email,
      status: row.status,
      dateOfBirth: row.dateOfBirth,
      countryCode: row.countryCode,
      onboarded: row.onboardedAt !== null,
      aal: token.aal,
    };
  }

  /** Coarse presence for Stage 1 (Redis presence replaces this in Stage 2). */
  private touchLastSeen(userId: string) {
    const now = Date.now();
    if (now - (this.lastSeenWrites.get(userId) ?? 0) < LAST_SEEN_WRITE_INTERVAL_MS) return;
    this.lastSeenWrites.set(userId, now);
    void this.db
      .update(users)
      .set({ lastSeenAt: sql`now()` })
      .where(eq(users.id, userId))
      .catch(() => this.lastSeenWrites.delete(userId));
  }
}
