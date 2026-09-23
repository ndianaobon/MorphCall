import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module.js';
import { SocialModule } from '../social/social.module.js';
import { SafetyController } from './safety.controller.js';
import { SafetyService } from './safety.service.js';

@Module({
  imports: [CallsModule, SocialModule],
  controllers: [SafetyController],
  providers: [SafetyService],
})
export class SafetyModule {}
