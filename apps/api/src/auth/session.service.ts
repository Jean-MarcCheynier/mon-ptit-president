import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { unauthenticated } from '../common/api.exception.js';
import { AppConfig } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateToken, hashToken } from './crypto.js';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Two tabs refreshing at the same time present the same token; the loser of the race
// must not be mistaken for a stolen token.
const REUSE_GRACE_MS = 30_000;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  /** Starts a new refresh-token family (one per login). */
  createSession(userId: string): Promise<SessionTokens> {
    return this.issue(userId, randomUUID());
  }

  /** Exchanges a refresh token for a new pair. A rotated token presented again revokes its family. */
  async rotate(refreshToken: string): Promise<{ userId: string; tokens: SessionTokens }> {
    const now = new Date();
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!existing || existing.expiresAt <= now) throw unauthenticated();

    if (existing.revokedAt) {
      if (now.getTime() - existing.revokedAt.getTime() > REUSE_GRACE_MS) {
        await this.revokeFamily(existing.familyId);
      }
      throw unauthenticated();
    }

    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (count === 0) throw unauthenticated();

    const tokens = await this.issue(existing.userId, existing.familyId);
    return { userId: existing.userId, tokens };
  }

  async revokeSession(refreshToken: string | undefined) {
    const familyId = await this.familyOf(refreshToken);
    if (familyId) await this.revokeFamily(familyId);
  }

  /** Revokes every session of the user, optionally keeping the one holding `keepRefreshToken`. */
  async revokeAllSessions(userId: string, keepRefreshToken?: string) {
    const keepFamilyId = await this.familyOf(keepRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(keepFamilyId ? { familyId: { not: keepFamilyId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
      return this.jwt.verify<AccessTokenPayload>(token);
    } catch {
      return null;
    }
  }

  private async issue(userId: string, familyId: string): Promise<SessionTokens> {
    const refreshToken = generateToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.config.get('REFRESH_TOKEN_TTL_DAYS') * DAY_MS),
      },
    });
    const accessToken = await this.jwt.signAsync({ sub: userId } satisfies AccessTokenPayload);
    return { accessToken, refreshToken };
  }

  private async familyOf(refreshToken: string | undefined): Promise<string | undefined> {
    if (!refreshToken) return undefined;
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { familyId: true },
    });
    return token?.familyId;
  }

  private revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
