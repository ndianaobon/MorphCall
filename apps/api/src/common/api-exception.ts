import { HttpException } from '@nestjs/common';
import type { ErrorCode } from '@morphcall/contracts';

/** Domain error with a stable code the UI maps to a state (docs/04-api.md §4). */
export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message, status);
  }

  static notFound(message = 'Not found') {
    return new ApiException(404, 'not_found', message);
  }
}
