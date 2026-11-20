import { Injectable } from '@nestjs/common';
import {
  type AuthProvider,
  ONBOARDING_VERSION,
  type PublicUser,
  type UpdateProfileInput,
} from '@presidency-bingo/shared';
import { unauthenticated } from '../common/api.exception.js';
import type { Account, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export function toPublicUser(user: User & { accounts: Pick<Account, 'provider'>[] }): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    hasPassword: user.passwordHash !== null,
    providers: user.accounts.map((account) => account.provider as AuthProvider),
    onboardingVersionSeen: user.onboardingVersionSeen,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicUser(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { accounts: { select: { provider: true } } },
    });
    // A valid access token for a deleted user.
    if (!user) throw unauthenticated();
    return toPublicUser(user);
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<PublicUser> {
    await this.prisma.user.update({ where: { id }, data: input });
    return this.getPublicUser(id);
  }

  /**
   * The player went through (or skipped) the current presentation. Never goes back: a player
   * who saw a newer version (during a deployment) keeps it.
   */
  async completeOnboarding(id: string): Promise<PublicUser> {
    await this.prisma.user.updateMany({
      where: { id, onboardingVersionSeen: { lt: ONBOARDING_VERSION } },
      data: { onboardingVersionSeen: ONBOARDING_VERSION },
    });
    return this.getPublicUser(id);
  }
}
