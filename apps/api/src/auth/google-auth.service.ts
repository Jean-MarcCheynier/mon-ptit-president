import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '@presidency-bingo/shared';
import { decodeIdToken, Google, generateCodeVerifier, generateState } from 'arctic';
import { ApiException } from '../common/api.exception.js';
import { AppConfig } from '../config/app-config.service.js';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

const PROVIDER = 'google';

const oauthFailed = (message: string) =>
  new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.OAUTH_FAILED, message);

/** Server-side authorization code flow with PKCE. */
@Injectable()
export class GoogleAuthService {
  private readonly client?: Google;

  constructor(
    private readonly prisma: PrismaService,
    config: AppConfig,
  ) {
    const clientId = config.get('GOOGLE_CLIENT_ID');
    const clientSecret = config.get('GOOGLE_CLIENT_SECRET');
    if (clientId && clientSecret) {
      const redirectUri = `${config.get('APP_URL')}/api/auth/google/callback`;
      this.client = new Google(clientId, clientSecret, redirectUri);
    }
  }

  get enabled(): boolean {
    return this.client !== undefined;
  }

  createAuthorization(): { url: URL; state: string; codeVerifier: string } {
    const client = this.requireClient();
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = client.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);
    url.searchParams.set('prompt', 'select_account');
    return { url, state, codeVerifier };
  }

  async handleCallback(code: string, codeVerifier: string): Promise<User> {
    let claims: Record<string, unknown>;
    try {
      const tokens = await this.requireClient().validateAuthorizationCode(code, codeVerifier);
      // Received directly from Google over TLS: no signature check needed.
      claims = decodeIdToken(tokens.idToken()) as Record<string, unknown>;
    } catch {
      throw oauthFailed('Google authorization failed');
    }
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') {
      throw oauthFailed('Google profile is incomplete');
    }
    return this.signInWithProfile({
      sub: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === 'string' ? claims.name : undefined,
      picture: typeof claims.picture === 'string' ? claims.picture : undefined,
    });
  }

  /** Finds the linked user, links an existing account by verified email, or creates one. */
  signInWithProfile(profile: GoogleProfile): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: {
          provider_providerAccountId: { provider: PROVIDER, providerAccountId: profile.sub },
        },
        include: { user: true },
      });
      if (account) return account.user;

      if (!profile.emailVerified) throw oauthFailed('Google email is not verified');

      const email = profile.email.toLowerCase();
      const link = { create: { provider: PROVIDER, providerAccountId: profile.sub } };
      const existing = await tx.user.findUnique({ where: { email } });

      if (existing) {
        return tx.user.update({
          where: { id: existing.id },
          data: {
            accounts: link,
            avatarUrl: existing.avatarUrl ?? profile.picture,
            // An unverified password may have been set by someone squatting the address
            // before its owner showed up: drop it now that Google proved ownership.
            ...(existing.emailVerifiedAt
              ? {}
              : { emailVerifiedAt: new Date(), passwordHash: null }),
          },
        });
      }

      return tx.user.create({
        data: {
          email,
          name: profile.name?.trim() || email.split('@')[0] || email,
          avatarUrl: profile.picture,
          emailVerifiedAt: new Date(),
          accounts: link,
        },
      });
    });
  }

  private requireClient(): Google {
    if (!this.client) throw oauthFailed('Google sign-in is not configured');
    return this.client;
  }
}
