import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module.js';
import { AvatarStore } from './avatar-store.js';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';

@Module({
  imports: [SocialModule],
  controllers: [MeController],
  providers: [MeService, AvatarStore],
})
export class MeModule {}
