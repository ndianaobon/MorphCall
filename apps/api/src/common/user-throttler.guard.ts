import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { ENV, type Env } from '../config/env.js';

/**
 * Rate-limits per verified user (runs after AuthGuard), per IP for anonymous callers.
 * Per-IP alone would lump together everyone behind carrier-grade NAT.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  @Inject(ENV) private readonly env!: Env;

  /**
   * Off in tests: the suite drives dozens of calls as the same user, which real limits
   * (deliberately) block. Limits stay on in development and production.
   */
  protected override async shouldSkip(): Promise<boolean> {
    return this.env.NODE_ENV === 'test';
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as FastifyRequest;
    return request.auth ? `user:${request.auth.userId}` : `ip:${request.ip}`;
  }
}
