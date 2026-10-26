import { ErrorCode } from '@presidency-bingo/shared';
import { ada, cookieValue, createTestApp, type TestApp, tokenFromEmail } from './test-app.js';

describe('Auth (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.app.close());
  beforeEach(() => t.reset());

  describe('register + email verification', () => {
    it('sends a verification email, blocks login until verified, then signs in', async () => {
      const res = await t
        .http()
        .post('/api/auth/register')
        .send({ ...ada, email: ' ADA@example.com ', locale: 'en' })
        .expect(202);
      expect(res.body.message).toBeDefined();

      const email = t.mail.lastTo(ada.email);
      expect(email?.subject).toBe('Confirm your email address');

      const blocked = await t
        .http()
        .post('/api/auth/login')
        .send({ email: ada.email, password: ada.password })
        .expect(403);
      expect(blocked.body.code).toBe(ErrorCode.EMAIL_NOT_VERIFIED);

      const agent = t.agent();
      const verified = await agent
        .post('/api/auth/verify-email')
        .send({ token: tokenFromEmail(email?.text) })
        .expect(200);
      expect(verified.body).toMatchObject({ email: ada.email, hasPassword: true, locale: 'en' });
      expect(verified.body.emailVerifiedAt).not.toBeNull();

      await agent.get('/api/me').expect(200);
    });

    it('rejects a verification token used twice', async () => {
      await t.http().post('/api/auth/register').send(ada).expect(202);
      const token = tokenFromEmail(t.mail.lastTo(ada.email)?.text);
      await t.http().post('/api/auth/verify-email').send({ token }).expect(200);
      const res = await t.http().post('/api/auth/verify-email').send({ token }).expect(400);
      expect(res.body.code).toBe(ErrorCode.INVALID_TOKEN);
    });

    it('resend invalidates the previous link', async () => {
      await t.http().post('/api/auth/register').send(ada).expect(202);
      const first = tokenFromEmail(t.mail.lastTo(ada.email)?.text);
      await t.http().post('/api/auth/resend-verification').send({ email: ada.email }).expect(202);
      const second = tokenFromEmail(t.mail.lastTo(ada.email)?.text);

      expect(second).not.toBe(first);
      await t.http().post('/api/auth/verify-email').send({ token: first }).expect(400);
      await t.http().post('/api/auth/verify-email').send({ token: second }).expect(200);
    });

    it('validates input with the shared schemas', async () => {
      const res = await t
        .http()
        .post('/api/auth/register')
        .send({ ...ada, password: 'short' })
        .expect(400);
      expect(res.body.issues).toEqual([{ path: 'password', message: 'validation.password.min' }]);
    });
  });

  describe('account enumeration', () => {
    it('answers a duplicate sign-up like a new one and warns the owner by email', async () => {
      await t.signUp();
      t.mail.clear();

      const res = await t.http().post('/api/auth/register').send(ada).expect(202);
      expect(res.body.message).toBeDefined();
      expect(t.mail.lastTo(ada.email)?.subject).toBe('Tentative d’inscription avec ton adresse');
    });

    it('gives the same login error for unknown emails and wrong passwords', async () => {
      await t.signUp();
      const unknown = await t
        .http()
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: ada.password })
        .expect(401);
      const wrong = await t
        .http()
        .post('/api/auth/login')
        .send({ email: ada.email, password: 'wrong password' })
        .expect(401);
      expect(unknown.body).toEqual(wrong.body);
    });

    it('accepts forgot-password for unknown emails without sending anything', async () => {
      await t
        .http()
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(202);
      expect(t.mail.sent).toHaveLength(0);
    });
  });

  describe('sessions', () => {
    it('rotates the refresh token and revokes the family when a rotated token is reused', async () => {
      await t.signUp();
      const login = await t
        .http()
        .post('/api/auth/login')
        .send({ email: ada.email, password: ada.password })
        .expect(200);
      const original = cookieValue(login, 'refresh_token');
      expect(original).toBeDefined();

      const rotated = await t
        .http()
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${original}`)
        .expect(204);
      const next = cookieValue(rotated, 'refresh_token');
      expect(next).toBeDefined();
      expect(next).not.toBe(original);

      // Outside the grace window, reusing the old token looks like theft.
      await t.prisma.refreshToken.updateMany({
        where: { revokedAt: { not: null } },
        data: { revokedAt: new Date(Date.now() - 60_000) },
      });
      await t
        .http()
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${original}`)
        .expect(401);
      await t.http().post('/api/auth/refresh').set('Cookie', `refresh_token=${next}`).expect(401);
    });

    it('tolerates a concurrent refresh within the grace window without revoking the family', async () => {
      await t.signUp();
      const login = await t
        .http()
        .post('/api/auth/login')
        .send({ email: ada.email, password: ada.password });
      const original = cookieValue(login, 'refresh_token');

      const rotated = await t
        .http()
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${original}`)
        .expect(204);
      await t
        .http()
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${original}`)
        .expect(401);
      await t
        .http()
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${cookieValue(rotated, 'refresh_token')}`)
        .expect(204);
    });

    it('logout revokes the session', async () => {
      const agent = await t.signUp();
      await agent.post('/api/auth/logout').expect(204);
      await agent.get('/api/me').expect(401);
      await agent.post('/api/auth/refresh').expect(401);
    });

    it('logout-all revokes every session', async () => {
      const first = await t.signUp();
      const second = t.agent();
      await second
        .post('/api/auth/login')
        .send({ email: ada.email, password: ada.password })
        .expect(200);

      await first.post('/api/auth/logout-all').expect(204);
      await second.post('/api/auth/refresh').expect(401);
    });

    it('rejects writes from a foreign origin', async () => {
      const res = await t
        .http()
        .post('/api/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ email: ada.email, password: ada.password })
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN_ORIGIN');
    });
  });

  describe('passwords', () => {
    it('reset password signs out every session', async () => {
      const agent = await t.signUp();
      await t.http().post('/api/auth/forgot-password').send({ email: ada.email }).expect(202);
      const token = tokenFromEmail(t.mail.lastTo(ada.email)?.text);

      await t
        .http()
        .post('/api/auth/reset-password')
        .send({ token, password: 'a brand new password' })
        .expect(204);

      await agent.post('/api/auth/refresh').expect(401);
      await t
        .http()
        .post('/api/auth/login')
        .send({ email: ada.email, password: 'a brand new password' })
        .expect(200);
    });

    it('change password requires the current one and keeps the current session', async () => {
      const agent = await t.signUp();
      const other = t.agent();
      await other.post('/api/auth/login').send({ email: ada.email, password: ada.password });

      const wrong = await agent
        .post('/api/auth/password')
        .send({ currentPassword: 'nope', newPassword: 'another password' })
        .expect(400);
      expect(wrong.body.code).toBe(ErrorCode.INVALID_CURRENT_PASSWORD);

      await agent
        .post('/api/auth/password')
        .send({ currentPassword: ada.password, newPassword: 'another password' })
        .expect(204);

      await agent.post('/api/auth/refresh').expect(204);
      await other.post('/api/auth/refresh').expect(401);
    });
  });
});
