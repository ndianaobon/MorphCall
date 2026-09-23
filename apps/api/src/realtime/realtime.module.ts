import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway.js';
import { RealtimeService } from './realtime.service.js';

@Global()
@Module({
  providers: [RealtimeService, EventsGateway],
  exports: [RealtimeService],
})
export class RealtimeModule {}
