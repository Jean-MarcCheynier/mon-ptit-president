import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth.js';

describe('registerSchema', () => {
  it('normalizes the email', () => {
    const parsed = registerSchema.parse({
      name: ' Ada ',
      email: '  Ada@Example.COM ',
      password: 'correct horse',
    });
    expect(parsed).toEqual({ name: 'Ada', email: 'ada@example.com', password: 'correct horse' });
  });

  it('rejects short passwords with an i18n key', () => {
    const result = registerSchema.safeParse({ name: 'Ada', email: 'a@b.co', password: 'short' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('validation.password.min');
  });

  it('rejects invalid emails', () => {
    const result = loginSchema.safeParse({ email: 'nope', password: 'x' });
    expect(result.error?.issues[0]?.message).toBe('validation.email.invalid');
  });
});
