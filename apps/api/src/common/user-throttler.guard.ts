import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';

/**
 * Rate-limits per verified user (runs after AuthGuard), per IP for anonymous callers.
 * Per-IP alone would lump together everyone behind carrier-grade NAT.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as FastifyRequest;
    return request.auth ? `user:${request.auth.userId}` : `ip:${request.ip}`;
  }
}
