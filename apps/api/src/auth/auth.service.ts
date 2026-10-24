import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type ChangePasswordInput,
  DEFAULT_LOCALE,
  ErrorCode,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@presidency-bingo/shared';
import { ApiException } from '../common/api.exception.js';
import { VerificationTokenType } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';
import { SessionService, type SessionTokens } from './session.service.js';
import { VerificationTokenService } from './verification-token.service.js';

const invalidToken = () =>
  new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_TOKEN, 'Invalid or expired link');

/**
 * Email/password flows. Register, resend and forgot-password always succeed from the
 * caller's point of view, so they never reveal whether an email is registered.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly verificationTokens: VerificationTokenService,
    private readonly mail: MailService,
  ) {}

  async register(input: RegisterInput): Promise<void> {
    // Hash first so both branches take comparable time.
    const passwordHash = await this.passwords.hash(input.password);
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });

    if (!existing) {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          locale: input.locale ?? DEFAULT_LOCALE,
          passwordHash,
        },
      });
      await this.sendVerification(user);
      return;
    }

    // Registered again before verifying: treat as a fresh sign-up.
    if (!existing.emailVerifiedAt && existing.passwordHash) {
      const user = await this.prisma.user.update({
        where: { id: existing.id },
        data: { name: input.name, passwordHash, locale: input.locale ?? existing.locale },
      });
      await this.sendVerification(user);
      return;
    }

    await this.mail.sendAccountExists(existing);
  }

  async login(input: LoginInput): Promise<{ userId: string; tokens: SessionTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const valid = user?.passwordHash
      ? await this.passwords.verify(user.passwordHash, input.password)
      : await this.passwords.verifyAgainstDummy(input.password);

    if (!user || !valid) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
      );
    }
    // Only revealed once the password is proven correct.
    if (!user.emailVerifiedAt) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        ErrorCode.EMAIL_NOT_VERIFIED,
        'Email address not verified',
      );
    }
    return { userId: user.id, tokens: await this.sessions.createSession(user.id) };
  }

  /** Verifies the email and signs the user in: the link proves ownership of the address. */
  async verifyEmail(token: string): Promise<{ userId: string; tokens: SessionTokens }> {
    const userId = await this.verificationTokens.consume(
      token,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    if (!userId) throw invalidToken();

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    return { userId, tokens: await this.sessions.createSession(userId) };
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt && user.passwordHash) {
      await this.sendVerification(user);
    }
  }

  /** Also lets Google-only accounts set a password. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = await this.verificationTokens.create(
      user.id,
      VerificationTokenType.PASSWORD_RESET,
    );
    await this.mail.sendPasswordReset(user, token);
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const userId = await this.verificationTokens.consume(
      input.token,
      VerificationTokenType.PASSWORD_RESET,
    );
    if (!userId) throw invalidToken();

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await this.passwords.hash(input.password),
        // The reset link proves ownership of the address.
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    });
    await this.sessions.revokeAllSessions(userId);
  }

  /** Requires the current password when one exists; signs out every other session. */
  async changePassword(userId: string, input: ChangePasswordInput, currentRefreshToken?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.passwordHash) {
      const valid =
        input.currentPassword !== undefined &&
        (await this.passwords.verify(user.passwordHash, input.currentPassword));
      if (!valid) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.INVALID_CURRENT_PASSWORD,
          'Current password is incorrect',
        );
      }
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(input.newPassword) },
    });
    await this.sessions.revokeAllSessions(userId, currentRefreshToken);
  }

  private async sendVerification(user: {
    id: string;
    email: string;
    name: string;
    locale: string;
  }) {
    const token = await this.verificationTokens.create(
      user.id,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    await this.mail.sendVerificationEmail(user, token);
  }
}
