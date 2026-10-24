import { HttpStatus } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth on top of SameSite=Lax cookies: browsers always send `Origin`
 * on cross-site writes, so rejecting foreign origins blocks forged requests.
 * Requests without `Origin` (curl, server-to-server) carry no browser cookies to abuse.
 */
export function originCheck(allowedOrigin: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (SAFE_METHODS.has(req.method) || !origin || origin === allowedOrigin) {
      return next();
    }
    res.status(HttpStatus.FORBIDDEN).json({
      statusCode: HttpStatus.FORBIDDEN,
      code: 'FORBIDDEN_ORIGIN',
      message: 'Origin not allowed',
    });
  };
}
