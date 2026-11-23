/**
 * Plays a stage of the election on the dev database: `pnpm db:simulate <step>`, a step being a
 * file of `simulation/` (without `.json`), applied on top of the real seed. `reset` goes back to
 * the real seed; without argument, lists the steps. Predictions are kept from one step to the
 * next (`pnpm db:reset` wipes them).
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { seedElection } from './election-seed.js';
import presidentielle2027 from './presidentielle-2027.json' with { type: 'json' };
import { applyStep, isLocalDatabase } from './simulation.js';

const STEPS_DIR = join(import.meta.dirname, 'simulation');

const steps = async () =>
  (await readdir(STEPS_DIR))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/, ''))
    .sort();

const name = process.argv[2];
if (!name) {
  console.log(
    `Steps (pnpm db:simulate <step>):\n${(await steps()).map((s) => `  ${s}`).join('\n')}`,
  );
  console.log('  reset  (back to the real seed)');
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!isLocalDatabase(url)) {
  const host = URL.parse(url ?? '')?.hostname || '(none)';
  console.error(`Refused: simulations only run on a local database, not on ${host}.`);
  process.exit(1);
}

let seed: unknown = presidentielle2027;
if (name !== 'reset') {
  if (!(await steps()).includes(name)) {
    console.error(`Unknown step "${name}". Steps: ${(await steps()).join(', ')}, reset.`);
    process.exit(1);
  }
  const step = JSON.parse(await readFile(join(STEPS_DIR, `${name}.json`), 'utf8'));
  seed = applyStep(presidentielle2027, step);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  const result = await seedElection(prisma, seed);
  console.log(
    `Simulated "${name}": ${result.candidates} candidates, ${result.favorites} favorites`,
  );
} finally {
  await prisma.$disconnect();
}
