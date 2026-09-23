import { Inject, Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { REALTIME_EVENTS } from '@morphcall/contracts';
import { eq, sql } from 'drizzle-orm';
import type { Server, Socket } from 'socket.io';
import { AccountContextService } from '../auth/account-context.service.js';
import { isUnderAge } from '../auth/auth-context.js';
import { JWT_VERIFIER, type JwtVerifier } from '../auth/jwt-verifier.js';
import { ENV, type Env } from '../config/env.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { RealtimeService } from './realtime.service.js';

interface AuthedSocket extends Socket {
  data: { userId?: string };
}

/**
 * WebSocket gateway for incoming calls and presence.
 * The handshake is authenticated exactly like a REST request: verified JWT + account state.
 */
@WebSocketGateway({ cors: { origin: true, credentials: false } })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer() server!: Server;

  constructor(
    @Inject(JWT_VERIFIER) private readonly verifier: JwtVerifier,
    private readonly accounts: AccountContextService,
    private readonly realtime: RealtimeService,
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
    if (this.env.NODE_ENV !== 'test') this.logger.log('Realtime gateway ready');
  }

  async handleConnection(socket: AuthedSocket) {
    const raw = socket.handshake.auth?.token;
    const token = typeof raw === 'string' ? raw : null;
    const verified = token ? await this.verifier.verify(token) : null;
    const account = verified ? await this.accounts.load(verified) : null;

    if (!account || account.status !== 'active' || isUnderAge(account) || !account.onboarded) {
      socket.emit('connect.rejected', { reason: 'unauthenticated' });
      socket.disconnect(true);
      return;
    }

    socket.data.userId = account.userId;
    await socket.join(this.realtime.room(account.userId));
    this.realtime.trackConnect(account.userId, socket.id);
    await this.touchLastSeen(account.userId);
  }

  handleDisconnect(socket: AuthedSocket) {
    const userId = socket.data.userId;
    if (userId) this.realtime.trackDisconnect(userId, socket.id);
  }

  /** Keeps the "online now" dot fresh while a tab is open. */
  @SubscribeMessage(REALTIME_EVENTS.presenceHeartbeat)
  async heartbeat(socket: AuthedSocket) {
    const userId = socket.data.userId;
    if (userId) await this.touchLastSeen(userId);
    return { ok: true };
  }

  private async touchLastSeen(userId: string) {
    await this.db
      .update(users)
      .set({ lastSeenAt: sql`now()` })
      .where(eq(users.id, userId));
  }
}
