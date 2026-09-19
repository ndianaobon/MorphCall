import { Controller, Get, HttpException, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Interest } from '@morphcall/contracts';
import { sql } from 'drizzle-orm';
import { Public } from '../auth/decorators.js';
import { DB, type Db } from '../db/db.module.js';

@Controller()
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('health')
  @Public()
  @SkipThrottle()
  async health() {
    const time = new Date().toISOString();
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok', db: 'ok', time };
    } catch {
      // 503 (not 500) so load balancers and uptime checks see "not ready" rather than a crash.
      throw new HttpException({ status: 'degraded', db: 'unreachable', time }, 503);
    }
  }

  @Get('interests')
  @Public()
  interests(): Promise<Interest[]> {
    return this.db.execute<Interest & Record<string, unknown>>(sql`
      select slug, label from app.interests where is_active order by label
    `);
  }
}
