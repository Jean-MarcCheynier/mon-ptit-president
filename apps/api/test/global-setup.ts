import { execSync } from 'node:child_process';

/** Applies migrations to the test database (DATABASE_URL comes from .env.test). */
export default function setup() {
  execSync('prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
