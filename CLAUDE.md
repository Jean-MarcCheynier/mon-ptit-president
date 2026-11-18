# CLAUDE.md

Mon p'tit président: a prediction game among friends around the French presidential election.
pnpm + Turborepo monorepo: `apps/api` (NestJS 12 ESM, Prisma 7, Postgres), `apps/web` (Vite, React 19,
TanStack Router/Query, Tailwind 4 + shadcn/ui), `packages/shared` (Zod schemas + types used by both the
API and the forms), `packages/emails` (React Email). Setup and architecture details: `README.md`.

## Commands

```bash
pnpm db:up && pnpm dev     # Postgres + Mailpit, then API :3000 + web :5173
pnpm lint                  # Biome (pnpm format to auto-fix)
pnpm typecheck
pnpm test                  # unit tests (Vitest)
pnpm test:e2e              # API e2e against the real app_test DB (needs pnpm db:up)
pnpm test:smoke:isolated   # Playwright on dedicated ports 3001/5174; use this one when pnpm dev runs
pnpm db:migrate            # after editing apps/api/prisma/schema.prisma
pnpm db:reset              # wipes the dev DB, replays migrations, regenerates the client, seeds
```

Before calling a change done, run `pnpm lint`, `pnpm typecheck` and the tests of the touched area.
CI (`.github/workflows/ci.yml`) runs lint, build, typecheck, unit, e2e and smoke on every push/PR.

## Conventions

- **Language**: code, identifiers and code comments in English. Domain vocabulary, UI copy, PR
  descriptions and docs (README, GLOSSARY, ADRs) in French.
- **Branches / commits**: `feat/<issue>-<slug>`, commits `feat(<issue>-<slug>): <summary>`;
  PRs reference the issue with `Closes #<n>`.
- **API imports are ESM**: relative imports end in `.js` (`import { X } from './x.js'`).
- **Shared validation**: request/response schemas live in `packages/shared` (Zod) and are reused by the
  Nest controllers and the React forms. Add new ones there, not inline in an app.
- **i18n**: every UI string goes through i18next, in both `fr` and `en` (`apps/web/src/i18n/locales`);
  `locales.test.ts` checks the keys match.
- **Tests sit next to the code**: `*.spec.ts` (API, shared), `*.test.tsx` (web), API e2e in
  `apps/api/test/*.e2e-spec.ts`, Playwright in `apps/web/e2e/`.
- **Don't edit generated code**: `apps/web/src/routeTree.gen.ts`, `apps/api/src/generated/`,
  `apps/web/src/components/ui/` (shadcn, add with `pnpm --filter @presidency-bingo/web dlx shadcn@latest add <name>`).
- Seed (`apps/api/src/seed`) must stay idempotent: it also runs against production.

## Gotchas

- The dev API rate-limits registration (5/h per IP): `pnpm test:smoke` against `pnpm dev` ends up
  failing on "Vérifie ta boîte mail". Use `pnpm test:smoke:isolated`.
- Dev emails land in Mailpit (http://localhost:8025), and the smoke tests read them from there.
- WSL: `gh` is `gh.exe`, and `git fetch`/`pull` over SSH fail; see `docs/agents/issue-tracker.md`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `Jean-MarcCheynier/mon-ptit-president` (via `gh.exe`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
Use the glossary's terms (joueur, phase, pool, vainqueur…) in code names, issues and UI copy.

coucou
