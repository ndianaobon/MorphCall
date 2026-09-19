import 'reflect-metadata';
import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';
import type { Env } from './config/env.js';

export function createFastifyAdapter(env: Env) {
  return new FastifyAdapter({
    logger:
      env.NODE_ENV === 'test' ? false : { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
    genReqId: (req: IncomingMessage) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
    },
    bodyLimit: 1024 * 1024,
    trustProxy: env.NODE_ENV === 'production',
  });
}

export async function createApp(env: Env): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(env),
    createFastifyAdapter(env),
  );
  await configureApp(app, env);
  return app;
}

export async function configureApp(app: NestFastifyApplication, env: Env) {
  await app.register(helmet, { contentSecurityPolicy: false });
  app.enableCors({
    origin: env.WEB_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'Idempotency-Key'],
    maxAge: 600,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });
}
