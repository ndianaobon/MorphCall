import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module.js';
import { CallsController, LiveKitWebhookController } from './calls.controller.js';
import { CallsService } from './calls.service.js';
import { LiveKitService } from './livekit.service.js';

@Module({
  imports: [SocialModule],
  controllers: [CallsController, LiveKitWebhookController],
  providers: [CallsService, LiveKitService],
  exports: [CallsService],
})
export class CallsModule {}
