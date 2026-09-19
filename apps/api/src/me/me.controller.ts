import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  accountBasicsInput,
  type AccountBasicsInput,
  avatarConfirmInput,
  profileUpdateInput,
  type ProfileUpdateInput,
  settingsUpdateInput,
  type SettingsUpdateInput,
  usernameSchema,
} from '@morphcall/contracts';
import type { AuthContext } from '../auth/auth-context.js';
import { AllowRestricted, CurrentUser, Public } from '../auth/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { MeService } from './me.service.js';

@Controller()
export class MeController {
  constructor(private readonly me: MeService) {}

  /** Reachable while restricted so the UI can explain why (suspended / under-age). */
  @Get('me')
  @AllowRestricted()
  getMe(@CurrentUser() auth: AuthContext) {
    return this.me.getMe(auth.userId);
  }

  @Put('me/basics')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  setBasics(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodPipe(accountBasicsInput)) input: AccountBasicsInput,
  ) {
    return this.me.setBasics(auth, input);
  }

  @Put('me/profile')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateProfile(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodPipe(profileUpdateInput)) input: ProfileUpdateInput,
  ) {
    return this.me.updateProfile(auth, input);
  }

  @Post('me/onboarding/complete')
  @HttpCode(200)
  complete(@CurrentUser() auth: AuthContext) {
    return this.me.completeOnboarding(auth);
  }

  @Patch('me/settings')
  updateSettings(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodPipe(settingsUpdateInput)) input: SettingsUpdateInput,
  ) {
    return this.me.updateSettings(auth.userId, input);
  }

  @Put('me/avatar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  setAvatar(
    @CurrentUser() auth: AuthContext,
    @Body(new ZodPipe(avatarConfirmInput)) input: { path: string },
  ) {
    return this.me.setAvatar(auth.userId, input.path);
  }

  @Delete('me/avatar')
  removeAvatar(@CurrentUser() auth: AuthContext) {
    return this.me.removeAvatar(auth.userId);
  }

  @Get('usernames/:username/availability')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async availability(@CurrentUser() auth: AuthContext | undefined, @Param('username') raw: string) {
    const parsed = usernameSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        username: raw,
        available: false,
        reason: parsed.error.issues[0]?.message ?? 'invalid',
      };
    }
    const available = await this.me.isUsernameAvailable(parsed.data, auth?.userId);
    return { username: parsed.data, available, reason: available ? null : 'taken' };
  }
}
