import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { CallsModule } from './calls/calls.module.js';
import { UserThrottlerGuard } from './common/user-throttler.guard.js';
import { ENV, type Env } from './config/env.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health/health.controller.js';
import { MeModule } from './me/me.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { SafetyModule } from './safety/safety.module.js';
import { SocialModule } from './social/social.module.js';

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        // In-memory limits for Stage 1; a Redis store replaces this once the API runs >1 instance.
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
        DbModule,
        AuthModule,
        RealtimeModule,
        SocialModule,
        MeModule,
        CallsModule,
        SafetyModule,
        AdminModule,
      ],
      controllers: [HealthController],
      providers: [
        { provide: ENV, useValue: env },
        // Global guards run in this order: authenticate first, then rate-limit per user / IP.
        { provide: APP_GUARD, useExisting: AuthGuard },
        { provide: APP_GUARD, useClass: UserThrottlerGuard },
      ],
      exports: [ENV],
    };
  }
}
