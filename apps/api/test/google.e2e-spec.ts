import { ErrorCode } from '@presidency-bingo/shared';
import { GoogleAuthService } from '../src/auth/google-auth.service.js';
import { createTestApp, type TestApp } from './test-app.js';

describe('Google sign-in (e2e)', () => {
  let t: TestApp;
  let google: GoogleAuthService;
  const profile = {
    sub: 'google-123',
    email: 'Grace@Example.com',
    emailVerified: true,
    name: 'Grace Hopper',
    picture: 'https://example.com/grace.png',
  };

  beforeAll(async () => {
    t = await createTestApp();
    google = t.app.get(GoogleAuthService);
  });
  afterAll(() => t.app.close());
  beforeEach(() => t.reset());

  it('creates a verified account without password', async () => {
    const user = await google.signInWithProfile(profile);
    expect(user).toMatchObject({
      email: 'grace@example.com',
      name: 'Grace Hopper',
      passwordHash: null,
    });
    expect(user.emailVerifiedAt).not.toBeNull();

    const again = await google.signInWithProfile({ ...profile, email: 'changed@example.com' });
    expect(again.id).toBe(user.id);
  });

  it('links an existing verified account and keeps its password', async () => {
    const existing = await t.prisma.user.create({
      data: {
        email: 'grace@example.com',
        name: 'Grace',
        passwordHash: 'hash',
        emailVerifiedAt: new Date(),
      },
    });
    const user = await google.signInWithProfile(profile);
    expect(user.id).toBe(existing.id);
    expect(user.passwordHash).toBe('hash');
    expect(await t.prisma.account.count({ where: { userId: existing.id } })).toBe(1);
  });

  it('drops the password of an unverified account it takes over', async () => {
    await t.prisma.user.create({
      data: { email: 'grace@example.com', name: 'Squatter', passwordHash: 'attacker-hash' },
    });
    const user = await google.signInWithProfile(profile);
    expect(user.passwordHash).toBeNull();
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it('refuses unverified Google emails', async () => {
    await expect(
      google.signInWithProfile({ ...profile, emailVerified: false }),
    ).rejects.toMatchObject({ response: { code: ErrorCode.OAUTH_FAILED } });
  });

  it('redirects to Google with state and PKCE cookies', async () => {
    const res = await t.http().get('/api/auth/google').expect(302);
    const location = new URL(res.headers.location as string);
    expect(location.hostname).toBe('accounts.google.com');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173/api/auth/google/callback',
    );
    expect(String(res.headers['set-cookie'])).toContain('google_oauth_state=');
  });

  it('sends the user back to /login when the callback state does not match', async () => {
    const res = await t.http().get('/api/auth/google/callback?code=x&state=forged').expect(302);
    expect(res.headers.location).toBe(
      `http://localhost:5173/login?error=${ErrorCode.OAUTH_FAILED}`,
    );
  });
});
