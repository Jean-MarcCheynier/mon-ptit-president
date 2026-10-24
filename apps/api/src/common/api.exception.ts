import { HttpException, HttpStatus } from '@nestjs/common';
import { type ApiError, ErrorCode } from '@presidency-bingo/shared';

export class ApiException extends HttpException {
  constructor(status: HttpStatus, code: ErrorCode, message: string = code) {
    super({ statusCode: status, code, message } satisfies ApiError, status);
  }
}

export const unauthenticated = () =>
  new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, 'Authentication required');
