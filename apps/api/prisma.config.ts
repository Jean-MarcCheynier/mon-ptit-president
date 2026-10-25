import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Not `env()`: that throws when unset, and `prisma generate` (Docker/CI builds) needs no database.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
