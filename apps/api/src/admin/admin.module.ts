import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CallsModule } from '../calls/calls.module.js';
import { SocialModule } from '../social/social.module.js';
import { AdminController } from './admin.controller.js';
import { AuditService } from './audit.service.js';
import { ModerationService } from './moderation.service.js';
import { StaffGuard } from './staff.guard.js';

@Module({
  imports: [CallsModule, SocialModule],
  controllers: [AdminController],
  providers: [
    ModerationService,
    AuditService,
    // Global, but only enforced on routes marked with @RequireStaff().
    { provide: APP_GUARD, useClass: StaffGuard },
  ],
})
export class AdminModule {}
