import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { originCheck } from './common/origin.middleware.js';
import { AppConfig } from './config/app-config.service.js';

/** Shared by main.ts and the e2e tests. */
export function setupApp(app: NestExpressApplication) {
  const config = app.get(AppConfig);
  app.setGlobalPrefix('api');
  // Behind Caddy / Docker networking: trust private proxies for req.ip.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(cookieParser());
  app.use(originCheck(new URL(config.get('APP_URL')).origin));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
}
