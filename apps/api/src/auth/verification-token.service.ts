import { Injectable } from '@nestjs/common';
import { VerificationTokenType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateToken, hashToken } from './crypto.js';

const TTL_MS: Record<VerificationTokenType, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

/** Single-use, hashed, expiring tokens sent by email (email verification, password reset). */
@Injectable()
export class VerificationTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a token, invalidating any previous unused one of the same type. */
  async create(userId: string, type: VerificationTokenType): Promise<string> {
    const token = generateToken();
    await this.prisma.$transaction([
      this.prisma.verificationToken.deleteMany({ where: { userId, type, usedAt: null } }),
      this.prisma.verificationToken.create({
        data: {
          userId,
          type,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + TTL_MS[type]),
        },
      }),
    ]);
    return token;
  }

  /** Marks the token as used and returns its user id, or null if invalid, expired or already used. */
  async consume(token: string, type: VerificationTokenType): Promise<string | null> {
    const now = new Date();
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.type !== type || record.usedAt || record.expiresAt <= now) return null;

    const { count } = await this.prisma.verificationToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: now },
    });
    return count === 1 ? record.userId : null;
  }
}
