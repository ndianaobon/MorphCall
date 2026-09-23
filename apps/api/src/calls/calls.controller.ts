import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  callHistoryQuery,
  type CallHistoryQuery,
  callQualityInput,
  type CallQualityInput,
  startCallInput,
  type StartCallInput,
} from '@morphcall/contracts';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthContext } from '../auth/auth-context.js';
import { CurrentUser, Public, RequireOnboarded } from '../auth/decorators.js';
import { ApiException } from '../common/api-exception.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { CallsService } from './calls.service.js';
import { LiveKitService } from './livekit.service.js';

const idParam = new ZodPipe(z.uuid());

@Controller()
@RequireOnboarded()
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Post('calls')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  start(@CurrentUser() me: AuthContext, @Body(new ZodPipe(startCallInput)) input: StartCallInput) {
    return this.calls.start(me.userId, input.calleeId);
  }

  @Post('calls/:id/accept')
  @HttpCode(200)
  accept(@CurrentUser() me: AuthContext, @Param('id', idParam) id: string) {
    return this.calls.accept(id, me.userId);
  }

  @Post('calls/:id/decline')
  @HttpCode(200)
  decline(@CurrentUser() me: AuthContext, @Param('id', idParam) id: string) {
    return this.calls.decline(id, me.userId);
  }

  @Post('calls/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() me: AuthContext, @Param('id', idParam) id: string) {
    return this.calls.cancel(id, me.userId);
  }

  @Post('calls/:id/end')
  @HttpCode(200)
  end(@CurrentUser() me: AuthContext, @Param('id', idParam) id: string) {
    return this.calls.end(id, me.userId);
  }

  @Post('calls/:id/token')
  @HttpCode(200)
  token(@CurrentUser() me: AuthContext, @Param('id', idParam) id: string) {
    return this.calls.reissueToken(id, me.userId);
  }

  @Post('calls/:id/quality')
  @HttpCode(200)
  quality(
    @CurrentUser() me: AuthContext,
    @Param('id', idParam) id: string,
    @Body(new ZodPipe(callQualityInput)) stats: CallQualityInput,
  ) {
    return this.calls.saveQuality(id, me.userId, stats);
  }

  @Get('calls/:id')
  summary(@CurrentUser() me: AuthContext, @Param('id', idParam) id: string) {
    return this.calls.summary(id, me.userId);
  }

  @Get('calls/history')
  history(
    @CurrentUser() me: AuthContext,
    @Query(new ZodPipe(callHistoryQuery)) query: CallHistoryQuery,
  ) {
    return this.calls.history(me.userId, query);
  }
}

@Controller()
export class LiveKitWebhookController {
  constructor(
    private readonly calls: CallsService,
    private readonly livekit: LiveKitService,
  ) {}

  /**
   * LiveKit posts room/participant events here. The body signature is verified against our
   * API secret — an unsigned or tampered body is rejected before anything is read from it.
   */
  @Post('webhooks/livekit')
  @Public()
  @HttpCode(200)
  async handle(@Req() request: FastifyRequest & { rawBody?: Buffer }) {
    const raw = request.rawBody?.toString('utf8');
    if (!raw) throw new ApiException(400, 'validation_error', 'Missing body.');
    let event;
    try {
      event = await this.livekit.receiveWebhook(raw, request.headers.authorization);
    } catch {
      throw new ApiException(401, 'unauthenticated', 'Invalid webhook signature.');
    }
    await this.calls.handleWebhook(event);
    return { received: true };
  }
}
