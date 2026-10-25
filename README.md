# Presidency Bingo

Monorepo web : **NestJS** + **PostgreSQL** (Prisma) côté API, **React** (Vite) côté front.
Authentification complète : inscription avec validation par email, connexion, connexion Google,
mot de passe oublié, sessions JWT.

## Stack

| Couche   | Choix                                                                       |
| -------- | --------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces + Turborepo, Biome (lint + format), Husky + lint-staged     |
| API      | NestJS 12 (ESM), Prisma 7 + PostgreSQL 17, argon2id, arctic (Google OAuth)  |
| Front    | Vite, React 19, TanStack Router + Query, Tailwind 4 + shadcn/ui, i18n fr/en |
| Partagé  | Schémas Zod (validation API **et** formulaires), templates React Email      |
| Emails   | SMTP via nodemailer : Mailpit (dev), Gmail ou Resend (prod)                 |
| Tests    | Vitest, e2e API (supertest + vraie base), Playwright (smoke)                |
| Prod     | Docker multi-stage, Caddy (HTTPS auto + proxy `/api`), docker compose       |

```
apps/
  api/        NestJS — src/{auth,users,mail,config,prisma,common}, prisma/schema.prisma
  web/        React — src/routes (pages, routing par fichiers), src/lib (client API, auth)
packages/
  shared/     schémas Zod + types partagés (@presidency-bingo/shared)
  emails/     templates React Email fr/en (@presidency-bingo/emails)
  config/     tsconfig partagés
infra/        Caddyfile, init Postgres
```

## Démarrer en local

Prérequis : Node 24 (`nvm use`), pnpm 12, Docker.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up            # Postgres + Mailpit
pnpm db:migrate       # applique les migrations Prisma
pnpm dev              # API :3000 + front :5173
```

| URL                            | Quoi                                                  |
| ------------------------------ | ----------------------------------------------------- |
| http://localhost:5173          | l'app (le proxy Vite redirige `/api` vers l'API)      |
| http://localhost:5173/api/docs | Swagger (désactivé en production)                     |
| http://localhost:8025          | Mailpit : tous les emails envoyés en dev arrivent ici |

## Authentification

### Validation de l'inscription par email

1. `POST /api/auth/register` crée l'utilisateur (`emailVerifiedAt = null`) et envoie un lien
   `/verify-email?token=…`. Seul le **hash SHA-256** du token est stocké (table
   `verification_tokens`). Le lien est valable 24 h et ne sert qu'une fois. Un renvoi invalide le précédent.
2. La page front fait un `POST /api/auth/verify-email`. Ce n'est volontairement pas un GET, pour que les
   scanners de liens des messageries ne consomment pas le token. L'adresse est alors marquée vérifiée et
   l'utilisateur est connecté.
3. Tant que l'email n'est pas vérifié, le login renvoie `403 EMAIL_NOT_VERIFIED`, et le front propose de
   renvoyer le lien.

Le mot de passe oublié utilise le même mécanisme (lien valable 1 h). Un reset déconnecte toutes les sessions.

**Anti-énumération** : register, resend et forgot-password répondent toujours `202` avec le même
message. Si quelqu'un s'inscrit avec une adresse déjà utilisée, le vrai propriétaire reçoit un email
« tentative d'inscription ». Le login renvoie la même erreur pour un email inconnu et pour un mauvais
mot de passe.

### Sessions

- **Access token** : JWT de 15 min, dans le cookie `access_token` (`httpOnly`, `SameSite=Lax`).
- **Refresh token** : valeur opaque de 30 jours, dans le cookie `refresh_token` limité au chemin `/api/auth`.
  Il est stocké hashé, avec **rotation** à chaque refresh. Si un token déjà utilisé est présenté à nouveau,
  toute sa famille est révoquée (détection de vol). Une fenêtre de 30 s tolère deux onglets qui
  rafraîchissent en même temps.
- Le client front (`apps/web/src/lib/api.ts`) intercepte les `401 UNAUTHENTICATED`, fait un seul
  refresh pour toutes les requêtes en attente, puis les rejoue.
- CSRF : `SameSite=Lax`, plus un contrôle de l'en-tête `Origin` sur les requêtes qui modifient des données.
  Le front et l'API sont toujours sur la même origine (proxy Vite en dev, Caddy en prod).

### Connexion Google

Flux _authorization code_ côté serveur, avec `state` et PKCE : `GET /api/auth/google` redirige vers Google,
puis le callback pose les cookies et renvoie vers l'app.

- Si un compte existe déjà avec le même email (et que Google le dit vérifié), Google y est **lié
  automatiquement**. Si ce compte n'avait jamais été vérifié, son mot de passe est supprimé, car il a pu
  être posé par quelqu'un d'autre.
- Un compte créé via Google n'a pas de mot de passe. Il peut en définir un via « mot de passe oublié »
  ou depuis les paramètres.

**Configuration** :

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → _Créer des identifiants_
   → _ID client OAuth_ → _Application Web_.
2. URI de redirection autorisée : `http://localhost:5173/api/auth/google/callback` (en prod :
   `https://<ton-domaine>/api/auth/google/callback`). Google exige HTTPS et un vrai domaine en prod.
3. Renseigner `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `apps/api/.env`. Sans eux, le bouton
   Google est simplement masqué.

### Rate limiting

| Route                                    | Limite                     |
| ---------------------------------------- | -------------------------- |
| `login`                                  | 5 / min par email          |
| `register`                               | 5 / h par IP               |
| `resend-verification`, `forgot-password` | 1 / min et 5 / h par email |
| toutes les autres                        | 100 / min par IP           |

Le stockage est en mémoire, ce qui suppose une seule instance de l'API. Pour en faire tourner plusieurs, il faudra brancher un store partagé.

## Emails

Les emails passent par `MailService` → `MailTransport` (`apps/api/src/mail`). L'implémentation par
défaut est SMTP : changer de fournisseur revient à changer les variables `SMTP_*`. Les presets
sont dans `apps/api/.env.example` :

- **Mailpit** (dev) : rien ne part réellement.
- **Gmail** avec un _mot de passe d'application_ (validation en 2 étapes requise). Limite d'environ 500
  emails par jour, l'expéditeur est forcément l'adresse Gmail. Bien pour démarrer sans nom de domaine.
- **Resend** une fois un domaine vérifié (SPF/DKIM).

Les templates sont dans `packages/emails` (React Email, fr/en selon la langue de l'utilisateur). Un échec
d'envoi est journalisé sans faire échouer la requête : l'utilisateur peut toujours redemander l'email.

## Tests

```bash
pnpm test         # unitaires (shared, emails, API, front)
pnpm test:e2e     # API de bout en bout sur la base app_test (pnpm db:up requis)
pnpm test:smoke   # Playwright : inscription → email (lu dans Mailpit) → connexion
pnpm lint         # Biome
pnpm typecheck
```

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute tout cela à chaque push et à chaque PR.

## Production

Trois conteneurs : **Caddy** (sert le front, gère le HTTPS automatique et proxifie `/api`) → **API** → **Postgres**.

```bash
cp .env.prod.example .env.prod   # remplir : DOMAIN, APP_URL, secrets, SMTP…
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

- Les migrations Prisma s'appliquent au démarrage de l'API.
- Avec `DOMAIN=mon-domaine.com` (enregistrement DNS A vers le serveur), Caddy obtient le certificat tout seul.
- Sans domaine, pour essayer sur l'IP du serveur : `DOMAIN=:80`, `APP_URL=http://<ip>`,
  `COOKIE_SECURE=false`. Pas de HTTPS dans ce cas, donc pas de connexion Google.

## Commandes utiles

```bash
pnpm db:migrate                                    # nouvelle migration après modification du schéma
pnpm --filter @presidency-bingo/api db:studio      # Prisma Studio
pnpm --filter @presidency-bingo/web dlx shadcn@latest add dialog   # ajouter un composant UI
```
