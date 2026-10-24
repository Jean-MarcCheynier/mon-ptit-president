import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../config/app-config.service.js';
import type { SessionTokens } from './session.service.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
// The refresh token is only sent to the auth routes.
const REFRESH_PATH = '/api/auth';

const DAY_MS = 24 * 60 * 60 * 1000;

function baseOptions(config: AppConfig): CookieOptions {
  return { httpOnly: true, secure: config.get('COOKIE_SECURE'), sameSite: 'lax' };
}

export function setAuthCookies(res: Response, tokens: SessionTokens, config: AppConfig) {
  const base = baseOptions(config);
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    path: '/',
    maxAge: config.get('JWT_ACCESS_TTL_SECONDS') * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    path: REFRESH_PATH,
    maxAge: config.get('REFRESH_TOKEN_TTL_DAYS') * DAY_MS,
  });
}

export function clearAuthCookies(res: Response, config: AppConfig) {
  const base = baseOptions(config);
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_PATH });
}
