import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type PublicUser,
  type UpdateProfileInput,
  updateProfileSchema,
} from '@presidency-bingo/shared';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { ZodBody } from '../common/zod-body.decorator.js';
import { UsersService } from './users.service.js';

@ApiTags('me')
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.users.getPublicUser(user.id);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthUser,
    @ZodBody(updateProfileSchema) body: UpdateProfileInput,
  ): Promise<PublicUser> {
    return this.users.updateProfile(user.id, body);
  }

  /** Records that the player went through (or skipped) the current presentation of the game. */
  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  completeOnboarding(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.users.completeOnboarding(user.id);
  }
}
