import type { ThrottlerOptions } from '@nestjs/throttler';
import type { Request } from 'express';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const emailTracker = (req: Record<string, unknown>) => {
  const body = (req as unknown as Request).body as { email?: unknown } | undefined;
  return typeof body?.email === 'string' ? body.email.trim().toLowerCase() : String(req.ip);
};

/**
 * Three named throttlers apply to every route. Defaults are permissive;
 * sensitive routes tighten them with `@Throttle({ <name>: { limit, ttl } })`.
 */
export const throttlers: ThrottlerOptions[] = [
  { name: 'ip', ttl: MINUTE, limit: 100 },
  { name: 'email', ttl: MINUTE, limit: 1000, getTracker: emailTracker },
  { name: 'emailHourly', ttl: HOUR, limit: 1000, getTracker: emailTracker },
];

export const THROTTLE = { MINUTE, HOUR };
