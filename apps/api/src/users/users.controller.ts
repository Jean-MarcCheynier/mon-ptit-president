import { Controller, Get, Patch } from '@nestjs/common';
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
}
