import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ApiError, ErrorCode } from '@morphcall/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiException } from './api-exception.js';

const STATUS_CODES: Record<number, ErrorCode> = {
  400: 'validation_error',
  401: 'unauthenticated',
  403: 'account_restricted',
  404: 'not_found',
  409: 'conflict',
  429: 'rate_limited',
};

/** Every error leaves the API in the same `{ error: { code, message, requestId } }` shape. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = 500;
    let code: ErrorCode = 'server_error';
    let message = 'Something went wrong on our side.';
    let details: unknown;

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ThrottlerException) {
      status = 429;
      code = 'rate_limited';
      message = 'Too many requests. Please slow down.';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_CODES[status] ?? (status >= 500 ? 'server_error' : 'validation_error');
      message = exception.message;
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const body: ApiError = { error: { code, message, details, requestId: request.id } };
    void reply.status(status).send(body);
  }
}
