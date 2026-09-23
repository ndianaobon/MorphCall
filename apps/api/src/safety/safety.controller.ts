import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  createBlockInput,
  type CreateBlockInput,
  createReportInput,
  type CreateReportInput,
} from '@morphcall/contracts';
import { z } from 'zod';
import type { AuthContext } from '../auth/auth-context.js';
import { CurrentUser, RequireOnboarded } from '../auth/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { SafetyService } from './safety.service.js';

const idParam = new ZodPipe(z.uuid());

@Controller()
@RequireOnboarded()
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}

  @Post('blocks')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  block(
    @CurrentUser() me: AuthContext,
    @Body(new ZodPipe(createBlockInput)) input: CreateBlockInput,
  ) {
    return this.safety.block(me.userId, input);
  }

  @Delete('blocks/:userId')
  unblock(@CurrentUser() me: AuthContext, @Param('userId', idParam) userId: string) {
    return this.safety.unblock(me.userId, userId);
  }

  @Get('blocks')
  list(@CurrentUser() me: AuthContext) {
    return this.safety.listBlocked(me.userId);
  }

  @Post('reports')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  report(
    @CurrentUser() me: AuthContext,
    @Body(new ZodPipe(createReportInput)) input: CreateReportInput,
  ) {
    return this.safety.report(me.userId, input);
  }
}
