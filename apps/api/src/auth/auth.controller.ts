import { Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type ChangePasswordInput,
  changePasswordSchema,
  type EmailOnlyInput,
  ErrorCode,
  emailOnlySchema,
  type LoginInput,
  loginSchema,
  type MessageResponse,
  type PublicUser,
  type RegisterInput,
  type ResetPasswordInput,
  registerSchema,
  resetPasswordSchema,
  type VerifyEmailInput,
  verifyEmailSchema,
} from '@presidency-bingo/shared';
import type { CookieOptions, Request, Response } from 'express';
import { unauthenticated } from '../common/api.exception.js';
import { THROTTLE } from '../common/throttle.js';
import { ZodBody } from '../common/zod-body.decorator.js';
import { AppConfig } from '../config/app-config.service.js';
import { UsersService } from '../users/users.service.js';
import { type AuthUser, CurrentUser, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './auth-cookies.js';
import { GoogleAuthService } from './google-auth.service.js';
import { SessionService } from './session.service.js';

const GENERIC_EMAIL_SENT: MessageResponse = {
  message: 'If the address is valid, an email is on its way.',
};

const GOOGLE_STATE_COOKIE = 'google_oauth_state';
const GOOGLE_VERIFIER_COOKIE = 'google_code_verifier';
const GOOGLE_COOKIE_PATH = '/api/auth/google';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly google: GoogleAuthService,
    private readonly users: UsersService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Get('providers')
  providers(): { google: boolean } {
    return { google: this.google.enabled };
  }

  @Public()
  @Throttle({ ip: { limit: 5, ttl: THROTTLE.HOUR } })
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  async register(@ZodBody(registerSchema) body: RegisterInput): Promise<MessageResponse> {
    await this.auth.register(body);
    return GENERIC_EMAIL_SENT;
  }

  @Public()
  @Throttle({ email: { limit: 5, ttl: THROTTLE.MINUTE } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @ZodBody(loginSchema) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const { userId, tokens } = await this.auth.login(body);
    setAuthCookies(res, tokens, this.config);
    return this.users.getPublicUser(userId);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @ZodBody(verifyEmailSchema) body: VerifyEmailInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const { userId, tokens } = await this.auth.verifyEmail(body.token);
    setAuthCookies(res, tokens, this.config);
    return this.users.getPublicUser(userId);
  }

  @Public()
  @Throttle({
    email: { limit: 1, ttl: THROTTLE.MINUTE },
    emailHourly: { limit: 5, ttl: THROTTLE.HOUR },
  })
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(
    @ZodBody(emailOnlySchema) body: EmailOnlyInput,
  ): Promise<MessageResponse> {
    await this.auth.resendVerification(body.email);
    return GENERIC_EMAIL_SENT;
  }

  @Public()
  @Throttle({
    email: { limit: 1, ttl: THROTTLE.MINUTE },
    emailHourly: { limit: 5, ttl: THROTTLE.HOUR },
  })
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@ZodBody(emailOnlySchema) body: EmailOnlyInput): Promise<MessageResponse> {
    await this.auth.forgotPassword(body.email);
    return GENERIC_EMAIL_SENT;
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@ZodBody(resetPasswordSchema) body: ResetPasswordInput): Promise<void> {
    await this.auth.resetPassword(body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof refreshToken !== 'string') throw unauthenticated();
    try {
      const { tokens } = await this.sessions.rotate(refreshToken);
      setAuthCookies(res, tokens, this.config);
    } catch (error) {
      clearAuthCookies(res, this.config);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.sessions.revokeSession(req.cookies?.[REFRESH_COOKIE]);
    clearAuthCookies(res, this.config);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.revokeAllSessions(user.id);
    clearAuthCookies(res, this.config);
  }

  /** Lives under /api/auth so the refresh cookie identifies the session to keep. */
  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @ZodBody(changePasswordSchema) body: ChangePasswordInput,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.changePassword(user.id, body, req.cookies?.[REFRESH_COOKIE]);
  }

  @Public()
  @Get('google')
  googleRedirect(@Res() res: Response) {
    const { url, state, codeVerifier } = this.google.createAuthorization();
    const options = this.googleCookieOptions();
    res.cookie(GOOGLE_STATE_COOKIE, state, options);
    res.cookie(GOOGLE_VERIFIER_COOKIE, codeVerifier, options);
    res.redirect(url.toString());
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const appUrl = this.config.get('APP_URL');
    const expectedState: unknown = req.cookies?.[GOOGLE_STATE_COOKIE];
    const codeVerifier: unknown = req.cookies?.[GOOGLE_VERIFIER_COOKIE];
    const { maxAge: _maxAge, ...clearOptions } = this.googleCookieOptions();
    res.clearCookie(GOOGLE_STATE_COOKIE, clearOptions);
    res.clearCookie(GOOGLE_VERIFIER_COOKIE, clearOptions);

    try {
      if (!code || !state || state !== expectedState || typeof codeVerifier !== 'string') {
        throw unauthenticated();
      }
      const user = await this.google.handleCallback(code, codeVerifier);
      setAuthCookies(res, await this.sessions.createSession(user.id), this.config);
      res.redirect(`${appUrl}/`);
    } catch {
      res.redirect(`${appUrl}/login?error=${ErrorCode.OAUTH_FAILED}`);
    }
  }

  private googleCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE'),
      sameSite: 'lax',
      path: GOOGLE_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    };
  }
}
