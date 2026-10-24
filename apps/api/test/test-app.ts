import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { InMemoryMailTransport } from '../src/mail/in-memory.transport.js';
import { MailTransport } from '../src/mail/mail-transport.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

export interface TestApp {
  app: NestExpressApplication;
  mail: InMemoryMailTransport;
  prisma: PrismaService;
  /** A client that keeps cookies between requests, like a browser. */
  agent: () => ReturnType<typeof request.agent>;
  http: () => ReturnType<typeof request>;
  reset: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const mail = new InMemoryMailTransport();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailTransport)
    .useValue(mail)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  setupApp(app);
  await app.init();
  const prisma = app.get(PrismaService);

  return {
    app,
    mail,
    prisma,
    agent: () => request.agent(app.getHttpServer()),
    http: () => request(app.getHttpServer()),
    reset: async () => {
      mail.clear();
      await prisma.$executeRawUnsafe(
        'TRUNCATE users, accounts, refresh_tokens, verification_tokens CASCADE',
      );
    },
  };
}

export function tokenFromEmail(text: string | undefined): string {
  const match = text?.match(/token=([\w-]+)/);
  if (!match?.[1]) throw new Error(`No token in email:\n${text}`);
  return match[1];
}

export function cookieValue(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith(`${name}=`));
  return cookie?.split(';')[0]?.slice(name.length + 1) || undefined;
}
