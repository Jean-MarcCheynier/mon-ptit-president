import { describe, expect, it } from 'vitest';
import { renderVerifyEmail } from './index.js';

describe('renderVerifyEmail', () => {
  it('renders html and text with the link, in the requested locale', async () => {
    const email = await renderVerifyEmail({
      locale: 'en',
      name: 'Ada',
      url: 'http://localhost:5173/verify-email?token=abc',
    });
    expect(email.subject).toBe('Confirm your email address');
    expect(email.html).toContain('verify-email?token=abc');
    expect(email.text).toContain('Hi Ada,');
  });
});
