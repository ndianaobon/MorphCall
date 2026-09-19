import { Module } from '@nestjs/common';
import { DiscoverService } from './discover.service.js';
import { FollowsService } from './follows.service.js';
import { ProfilesService } from './profiles.service.js';
import { RelationshipPolicy } from './relationship.policy.js';
import { SocialController } from './social.controller.js';
import { StorageUrls } from './storage-urls.js';

@Module({
  controllers: [SocialController],
  providers: [RelationshipPolicy, StorageUrls, ProfilesService, DiscoverService, FollowsService],
  exports: [RelationshipPolicy, StorageUrls, ProfilesService],
})
export class SocialModule {}
