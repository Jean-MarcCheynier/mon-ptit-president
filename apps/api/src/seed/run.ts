import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { seedElection } from './election-seed.js';
import presidentielle2027 from './presidentielle-2027.json' with { type: 'json' };

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const result = await seedElection(prisma, presidentielle2027);
  console.log(`Seeded ${presidentielle2027.election.slug}: ${result.candidates} candidates`);
} finally {
  await prisma.$disconnect();
}
