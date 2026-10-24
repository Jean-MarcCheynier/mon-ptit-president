import { generateToken, hashToken } from './crypto.js';

describe('crypto', () => {
  it('generates unique url-safe tokens', () => {
    const a = generateToken();
    expect(a).toMatch(/^[\w-]{43}$/);
    expect(generateToken()).not.toBe(a);
  });

  it('hashes deterministically', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe('abc');
  });
});
