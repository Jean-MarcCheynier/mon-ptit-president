import { validateEnv } from './env.js';

const base = {
  APP_URL: 'http://localhost:5173/',
  DATABASE_URL: 'postgresql://app:app@localhost:5432/app',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  MAIL_FROM: 'App <noreply@localhost>',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
};

describe('validateEnv', () => {
  it('applies defaults and normalizes values', () => {
    const env = validateEnv(base);
    expect(env.APP_URL).toBe('http://localhost:5173');
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.RATE_LIMIT_ENABLED).toBe(true);
    expect(env.SMTP_PORT).toBe(1025);
  });

  it('secures cookies in production by default', () => {
    expect(validateEnv({ ...base, NODE_ENV: 'production' }).COOKIE_SECURE).toBe(true);
  });

  it('fails fast on a weak JWT secret', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });
});
