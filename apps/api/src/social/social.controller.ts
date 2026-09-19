import { Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  discoverQuery,
  type DiscoverQuery,
  paginationQuery,
  type PaginationQuery,
  searchQuery,
} from '@morphcall/contracts';
import { z } from 'zod';
import type { AuthContext } from '../auth/auth-context.js';
import { CurrentUser, Public, RequireOnboarded } from '../auth/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DiscoverService } from './discover.service.js';
import { FollowsService } from './follows.service.js';
import { ProfilesService } from './profiles.service.js';

const idParam = new ZodPipe(z.uuid());
const handleParam = new ZodPipe(z.string().min(1).max(64));

@Controller()
export class SocialController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly discover: DiscoverService,
    private readonly follows: FollowsService,
  ) {}

  @Get('discover')
  @RequireOnboarded()
  discoverPeople(
    @CurrentUser() me: AuthContext,
    @Query(new ZodPipe(discoverQuery)) query: DiscoverQuery,
  ) {
    return this.discover.discover(me.userId, query);
  }

  @Get('users/search')
  @RequireOnboarded()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  search(
    @CurrentUser() me: AuthContext,
    @Query(new ZodPipe(searchQuery)) query: z.output<typeof searchQuery>,
  ) {
    return this.discover.search(me.userId, query.q, query.limit);
  }

  @Get('follow-requests')
  @RequireOnboarded()
  followRequests(
    @CurrentUser() me: AuthContext,
    @Query(new ZodPipe(paginationQuery)) page: PaginationQuery,
  ) {
    return this.discover.followRequests(me.userId, page);
  }

  /** Public so /@username pages can render for signed-out visitors (fields filtered by visibility). */
  @Get('users/:handle')
  @Public()
  async profile(
    @CurrentUser() me: AuthContext | undefined,
    @Param('handle', handleParam) handle: string,
  ) {
    const id = await this.profiles.resolveHandle(handle);
    return this.profiles.getProfile(id, me?.onboarded ? me.userId : null);
  }

  @Get('users/:id/followers')
  @RequireOnboarded()
  followers(
    @CurrentUser() me: AuthContext,
    @Param('id', idParam) id: string,
    @Query(new ZodPipe(paginationQuery)) page: PaginationQuery,
  ) {
    return this.discover.connections(me.userId, id, 'followers', page);
  }

  @Get('users/:id/following')
  @RequireOnboarded()
  following(
    @CurrentUser() me: AuthContext,
    @Param('id', idParam) id: string,
    @Query(new ZodPipe(paginationQuery)) page: PaginationQuery,
  ) {
    return this.discover.connections(me.userId, id, 'following', page);
  }

  @Post('users/:id/follow')
  @RequireOnboarded()
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  follow(@CurrentUser() me: AuthContext, @Param('id', idParam) id: string) {
    return this.follows.follow(me.userId, id);
  }

  @Delete('users/:id/follow')
  @RequireOnboarded()
  unfollow(@CurrentUser() me: AuthContext, @Param('id', idParam) id: string) {
    return this.follows.unfollow(me.userId, id);
  }

  @Post('follow-requests/:followerId/accept')
  @RequireOnboarded()
  @HttpCode(200)
  accept(@CurrentUser() me: AuthContext, @Param('followerId', idParam) followerId: string) {
    return this.follows.acceptRequest(me.userId, followerId);
  }

  @Post('follow-requests/:followerId/decline')
  @RequireOnboarded()
  @HttpCode(200)
  decline(@CurrentUser() me: AuthContext, @Param('followerId', idParam) followerId: string) {
    return this.follows.declineRequest(me.userId, followerId);
  }
}
