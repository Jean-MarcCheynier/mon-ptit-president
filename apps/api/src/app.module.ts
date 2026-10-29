import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { BallotsModule } from './ballots/ballots.module.js';
import { throttlers } from './common/throttle.js';
import { AppConfig } from './config/app-config.service.js';
import { ConfigModule } from './config/config.module.js';
import { ElectionsModule } from './elections/elections.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers,
        skipIf: () => !config.get('RATE_LIMIT_ENABLED'),
      }),
    }),
    AuthModule,
    UsersModule,
    ElectionsModule,
    BallotsModule,
  ],
  controllers: [HealthController],
  // Registered before AuthModule's JwtAuthGuard, so rate limiting runs first.
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
