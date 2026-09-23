import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
  type WebhookEvent,
} from 'livekit-server-sdk';
import { ENV, type Env } from '../config/env.js';

/** Tokens live just long enough to join; LiveKit refreshes them for connected clients. */
export const TOKEN_TTL_SECONDS = 600;

/** Reserved prefix — only the API mints these, which is what makes the AI badge trustworthy (docs/02 §1.2). */
export const AI_WORKER_PREFIX = 'ai-worker:';

export const userIdentity = (userId: string) => `u:${userId}`;
export const userIdFromIdentity = (identity: string) =>
  identity.startsWith('u:') ? identity.slice(2) : null;

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly rooms: RoomServiceClient;
  private readonly receiver: WebhookReceiver;

  constructor(@Inject(ENV) private readonly env: Env) {
    // The server SDK talks HTTP(S) to the same host the browsers reach over WS(S).
    const httpUrl = env.LIVEKIT_URL.replace(/^ws/, 'http');
    this.rooms = new RoomServiceClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
    this.receiver = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  }

  get url() {
    return this.env.LIVEKIT_URL;
  }

  /** Join token for a real user: may publish camera/mic/screen in this room only. */
  async userToken(input: {
    roomName: string;
    userId: string;
    displayName: string;
  }): Promise<string> {
    const at = new AccessToken(this.env.LIVEKIT_API_KEY, this.env.LIVEKIT_API_SECRET, {
      identity: userIdentity(input.userId),
      name: input.displayName,
      ttl: TOKEN_TTL_SECONDS,
    });
    at.addGrant({
      room: input.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    return at.toJwt();
  }

  /** Best-effort: closes the room so nobody can rejoin an ended call. */
  async closeRoom(roomName: string): Promise<void> {
    try {
      await this.rooms.deleteRoom(roomName);
    } catch (err) {
      this.logger.warn(`Could not delete LiveKit room ${roomName}: ${(err as Error).message}`);
    }
  }

  /** Verifies the webhook signature; throws if the body was not signed by our LiveKit. */
  async receiveWebhook(body: string, authHeader: string | undefined): Promise<WebhookEvent> {
    return this.receiver.receive(body, authHeader);
  }
}
