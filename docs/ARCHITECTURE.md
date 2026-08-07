# Architecture — MAGAZINE v2

## Vue d’ensemble

```
Internet
   │
   ├─ Cloudflare (DNS)
   │
   ▼
DigitalOcean Droplet (Docker Compose)
├─ nginx          :80 / :443  (reverse proxy + TLS)
├─ web            :3000       Next.js 16     → https://egouv.online
├─ api            :3001       NestJS         → https://api.egouv.online
└─ worker                     même image NestJS, process BullMQ
         │
         ├── Managed PostgreSQL (Prisma)
         ├── Managed Redis (cache + queues BullMQ)
         └── Cloudflare R2 (PDF, covers, images)
```

Domaines :

| Hôte | Service |
|------|---------|
| `egouv.online` / `www.egouv.online` | Front Next.js |
| `api.egouv.online` | API NestJS (+ webhooks Stripe / FlexPaie) |
| `cdn.egouv.online` (optionnel) | Médias R2 |

## Applications

### `apps/web` — Next.js 16

- Site public : home, kiosque, actualités, pricing, profil, lecture PDF
- Espace abonné : abonnements, achats, notifications, settings
- Admin (`/admin`) : magazines, formules, abonnés, actualités, paiements
- TanStack Query pour le data fetching
- React Hook Form + Zod pour les formulaires
- PDF.js pour le lecteur (remplace `flip/` / turn.js)

### `apps/api` — NestJS

Modules prévus :

| Module | Responsabilité |
|--------|----------------|
| `auth` | Inscription, login, reset password, Google OAuth, JWT/session |
| `users` | Abonnés + users admin (rôles) |
| `magazines` | CRUD magazines, accès lecture selon abo/achat |
| `subscriptions` | Formules, abonnements, renouvellement |
| `payments` | Stripe (carte) + FlexPaie (mobile) — webhooks + idempotence |
| `articles` | Actualités, commentaires, catégories |
| `media` | Upload signé R2, métadonnées fichiers |
| `notifications` | Emails transactionnels via **Resend** + queue BullMQ |
| `admin` | Endpoints réservés back-office |

### Worker BullMQ

Même codebase NestJS, entrypoint `worker` :

- Envoi emails via **Resend** (activation, facture, reset password)
- Renouvellement / expiration abonnements
- Optimisation images / préparation PDF après upload
- Traitement webhooks paiement asynchrones si besoin

## Stockage R2

| Préfixe | Contenu |
|---------|---------|
| `magazines/pdf/` | PDF complets |
| `magazines/preview/` | Extraits / previews |
| `covers/` | Couvertures magazines |
| `articles/` | Images articles |
| `profiles/` | Avatars abonnés |
| `slides/` | Bannières home |

Accès : URLs publiques CDN R2 pour covers/images ; URLs signées temporaires pour PDF payants.

## Paiements (v2)

| Canal | Provider | Usage |
|-------|----------|--------|
| Carte bancaire | **Stripe** | Checkout / Payment Intents + webhooks |
| Mobile Money | **FlexPaie** | Paiement mobile (Airtel, Orange, M-Pesa, etc.) + callback |

Le legacy (MaxiCash, PayPal, MoMo) **n’est pas repris** en v2. Les abonnements / achats existants restent en base ; les nouveaux paiements passent uniquement par Stripe et FlexPaie.

Flux type :

1. Client choisit **carte** ou **mobile**
2. API Nest crée une intention de paiement (`Payment` en DB, statut `PENDING`)
3. Redirection / SDK Stripe **ou** push USSD/OTP FlexPaie
4. Webhook / callback → validation idempotente → activation abo ou achat
5. Job BullMQ : email facture / confirmation

## Auth

- Abonnés (`Subscriber`) et staff (`AdminUser`) séparés côté modèle
- JWT (access + refresh) ou sessions HTTP-only cookies (à trancher au scaffold)
- Hash existants bcrypt (`$2y$10$…`) réutilisables tels quels avec bcrypt Node

## Environnements

| Env | Usage |
|-----|--------|
| `development` | Docker Compose local (Postgres + Redis locaux possibles) |
| `staging` | Droplet ou même Droplet, domaine staging |
| `production` | Droplet prod + Managed Postgres/Redis + R2 |
