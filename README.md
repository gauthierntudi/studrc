# OPT1MUM v2

Monorepo Next.js 16 + NestJS.

**Domaine actuel :** [egouv.online](https://egouv.online) · API `api.egouv.online`  
**Cible plus tard :** `opt1mum.com` — voir [docs/DOMAINES.md](./docs/DOMAINES.md)

## Stack

| Couche | Techno |
|--------|--------|
| Web | Next.js 16, Tailwind, TanStack Query, RHF, Zod, shadcn/ui |
| API | NestJS, Prisma, PostgreSQL, Redis, BullMQ |
| Paiements | Stripe (live) · FlexPaie |
| Email | Resend |
| Médias | Cloudflare R2 |
| Deploy | DigitalOcean Droplet + Docker Compose |

## Structure

```
v2/
├── apps/web          # Next.js → :3000
├── apps/api          # NestJS  → :3001/api
├── deploy/           # Nginx, env example
├── docs/             # Architecture, migration, paiements…
├── docker-compose.dev.yml   # Postgres + Redis locaux
└── docker-compose.yml       # Prod (web, api, worker, nginx)
```

## Quick start (local)

```bash
# 1. Infra locale (Postgres :5433, Redis :6379)
docker compose -f docker-compose.dev.yml up -d
# ou : pnpm docker:dev

# 2. Dépendances (depuis v2/)
pnpm install

# 3. Prisma
pnpm db:generate
pnpm db:migrate

# 4. Dev
pnpm dev
```

- Site : http://localhost:3000  
- API health : http://localhost:3001/api/health  

Configurer les secrets dans `v2/.env` (jamais committer).

## Documentation

1. [Architecture](./docs/ARCHITECTURE.md)
2. [Domaines](./docs/DOMAINES.md)
3. [UI legacy → React](./docs/UI.md)
4. [Migration](./docs/MIGRATION.md)
5. [Paiements](./docs/PAIEMENTS.md)
6. [Emails Resend](./docs/EMAILS.md)
7. [Déploiement DO](./docs/DEPLOIEMENT.md)

## Statut

- [x] Docs migration / déploiement / paiements / emails
- [x] Scaffold monorepo (web + api + Prisma + Docker)
- [x] Auth abonnés (register / login / me / refresh / logout)
- [x] Auth finalisée (verify email Resend, reset password, admin)
- [x] Design system Opt1mum (tokens + shells public/admin)
- [ ] UI kiosque / lecteur PDF / admin magazines (données)
- [ ] Stripe + FlexPaie branchés
- [ ] ETL MySQL → Postgres + médias R2
- [ ] Cutover production (`egouv.online` puis `opt1mum.com`)
