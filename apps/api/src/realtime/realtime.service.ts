import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * Fan-out to a user's open tabs, plus in-memory presence.
 * Single-instance only: Stage 2 dev. Swap in the socket.io Redis adapter before running
 * more than one API instance (docs/01 §3).
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;
  private readonly sockets = new Map<string, Set<string>>();

  attach(server: Server) {
    this.server = server;
  }

  room(userId: string) {
    return `user:${userId}`;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    if (!this.server) {
      this.logger.warn(`No realtime server attached; dropped "${event}" for ${userId}`);
      return;
    }
    this.server.to(this.room(userId)).emit(event, payload);
  }

  trackConnect(userId: string, socketId: string) {
    const set = this.sockets.get(userId) ?? new Set<string>();
    set.add(socketId);
    this.sockets.set(userId, set);
  }

  trackDisconnect(userId: string, socketId: string) {
    const set = this.sockets.get(userId);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) this.sockets.delete(userId);
  }

  isConnected(userId: string) {
    return this.sockets.has(userId);
  }
}
