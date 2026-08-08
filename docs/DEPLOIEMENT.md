# Déploiement — DigitalOcean Droplet + Docker Compose

Cible retenue : **contrôle maximal** via Droplet(s) Dockerisés, avec **PostgreSQL** et **Redis managés** DigitalOcean, médias sur **Cloudflare R2**.

## 1. Architecture d’hébergement

```
                    Cloudflare DNS
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     egouv.online                  api.egouv.online
              │                         │
              └────────────┬────────────┘
                           ▼
              Droplet Ubuntu 24.04
              ┌─────────────────────┐
              │  nginx (:80/:443)   │
              │  web   (Next :3000) │
              │  api   (Nest :3001) │
              │  worker (BullMQ)    │
              └──────────┬──────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
  Managed Postgres  Managed Redis   Cloudflare R2
```

### Pourquoi cette découpe

| Composant | Emplacement | Raison |
|-----------|-------------|--------|
| `web` / `api` / `worker` / `nginx` | Droplet Docker | Contrôle, coûts prévisibles, workers PDF |
| PostgreSQL | Managed DB | Backups, updates, pas de charge disque app |
| Redis | Managed Redis | Persistance files BullMQ + HA simple |
| PDF / images / covers | R2 | Stockage objet cheap + CDN, hors Droplet |

## 2. Dimensionnement initial

### Droplet

| Profil | Spec | Quand |
|--------|------|-------|
| Starter | 2 vCPU / 4 Go RAM / 80 Go SSD | Staging / début prod faible trafic |
| Recommandé | 4 vCPU / 8 Go RAM / 160 Go SSD | Prod avec uploads PDF + workers |
| Région | Closest users (ex. `fra1` / `ams3`) | Latence RDC/Europe à arbitrer |

Firewall Droplet (Cloud Firewall DO) :

- Inbound : `22` (SSH restreint IP), `80`, `443`
- Outbound : all (API paiements, R2, Resend)

### Managed PostgreSQL

- Plan de base (1–2 Go RAM) au lancement
- SSL obligatoire (`DATABASE_URL` avec `sslmode=require`)
- Trusted sources = IP du Droplet uniquement

### Managed Redis

- Plan de base
- Utilisé pour : cache API + queues BullMQ (`magazine:` prefix)
- Persistence activée si disponible sur le plan

### Cloudflare R2

- 1 bucket prod (+ 1 staging optionnel)
- Clés API limitées au bucket
- CORS autorisant les domaines web
- **Uploads PDF admin (presigned)** : le navigateur envoie le fichier en `PUT` direct vers R2. CORS bucket obligatoire (`GET`, `PUT`, `HEAD` + header `Content-Type`) pour `APP_URL` / localhost. Configurer avec :
  ```bash
  pnpm --filter @opt1mum/api configure:r2-cors
  ```
  Origins supplémentaires : `R2_CORS_ORIGINS=https://admin.example.com,https://www.example.com`
- **Custom domain** (ex. `cdn.egouv.online`) : à lier au bucket dans Cloudflare R2 → Settings → Custom Domains. Sans enregistrement DNS, le navigateur renvoie `ERR_NAME_NOT_RESOLVED` (ce n’est pas un problème CORS). En attendant : `AVATAR_USE_CDN=false` sert les photos via `/legacy/profil`.

## 3. Services Docker (cible)

Fichiers prévus :

```
v2/
├── docker-compose.yml           # prod / staging sur Droplet
├── docker-compose.dev.yml       # local (Postgres + Redis inclus)
├── deploy/
│   ├── nginx/
│   │   └── default.conf
│   └── .env.example
```

### Services Compose prod

| Service | Image / build | Rôle |
|---------|---------------|------|
| `nginx` | `nginx:alpine` | TLS, reverse proxy |
| `web` | `apps/web` Dockerfile | Next.js |
| `api` | `apps/api` Dockerfile | NestJS HTTP |
| `worker` | même image `api` | `node dist/worker.js` |

**Ne pas** lancer Postgres/Redis en Compose sur le Droplet prod : utiliser les managed DO.

### Exemple Compose (référence)

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./deploy/certbot/conf:/etc/letsencrypt:ro
      - ./deploy/certbot/www:/var/www/certbot:ro
    depends_on:
      - web
      - api
    restart: unless-stopped

  web:
    build:
      context: ./apps/web
    env_file: .env
    expose:
      - "3000"
    restart: unless-stopped

  api:
    build:
      context: ./apps/api
    env_file: .env
    command: node dist/main.js
    expose:
      - "3001"
    restart: unless-stopped

  worker:
    build:
      context: ./apps/api
    env_file: .env
    command: node dist/worker.js
    restart: unless-stopped
```

### Routage Nginx

- `egouv.online` / `www.egouv.online` → `web:3000`
- `api.egouv.online` → `api:3001`

TLS : Certbot (Let’s Encrypt) ou certificats Cloudflare (Full Strict).

## 4. Variables d’environnement

Fichier sur le Droplet : `/opt/magazine/v2/.env` (jamais commitré).

```bash
# Apps
NODE_ENV=production
APP_URL=https://egouv.online
API_URL=https://api.egouv.online
NEXT_PUBLIC_API_URL=https://api.egouv.online

# Auth
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
COOKIE_DOMAIN=.egouv.online

# Database (Managed Postgres)
DATABASE_URL=postgresql://user:pass@host:25060/magazine?sslmode=require

# Redis (Managed)
REDIS_URL=rediss://default:pass@host:25061

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=magazine-prod
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://cdn.egouv.online

# Stripe (carte) — LIVE
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# FlexPaie (mobile)
FLEXPAIE_MERCHANT=
FLEXPAIE_TOKEN=
FLEXPAIE_MOBILE_API_URL=https://backend.flexpay.cd/api/rest/v1/paymentService
FLEXPAIE_CARD_API_URL=https://cardpayment.flexpay.cd/v1.1/pay
FLEXPAIE_CHECK_API_URL=https://backend.flexpay.cd/api/rest/v1/check
FLEXPAIE_CALLBACK_URL=https://api.egouv.online/payments/flexpaie/callback

# Email — Resend
RESEND_API_KEY=re_...
MAIL_FROM=Optimum <noreply@egouv.online>
```

> **Note** : MaxiCash / PayPal / MoMo ne sont plus utilisés en v2. Emails via **Resend** (pas SMTP).

## 5. Provisionning initial (checklist)

### DigitalOcean

1. [ ] Créer Droplet Ubuntu 24.04
2. [ ] Créer Managed PostgreSQL + DB `magazine`
3. [ ] Créer Managed Redis
4. [ ] Cloud Firewall (22/80/443)
5. [ ] Ajouter IP Droplet aux trusted sources Postgres/Redis
6. [ ] (Optionnel) Floating IP

### Droplet OS

```bash
# Docker
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Outils
sudo apt install -y git ufw fail2ban
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Cloudflare

1. [ ] DNS `A` / `CNAME` vers Droplet (ou Floating IP)
2. [ ] Bucket R2 + token API
3. [ ] Domaine custom CDN pour covers (optionnel)
4. [ ] SSL mode Full (strict) si proxy orange

### Application

```bash
sudo mkdir -p /opt/magazine
sudo chown $USER:$USER /opt/magazine
cd /opt/magazine
git clone <repo> .
cd v2
cp deploy/.env.example .env   # puis éditer
docker compose pull           # ou build
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
```

## 6. Déploiement / mises à jour

### Manuel (simple)

```bash
cd /opt/magazine
git pull
cd v2
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma generate   # si besoin
```

### CI/CD (GitHub Actions → VPS)

À chaque push sur `main`, le workflow `.github/workflows/deploy.yml` se connecte en SSH et exécute `deploy/remote-deploy.sh` (`git pull`, rebuild `api`/`web`/`worker`, migrations Prisma, recreate nginx).

#### 1. Clé SSH pour GitHub Actions → VPS

Sur ton Mac :

```bash
ssh-keygen -t ed25519 -C "github-actions-opt1mum" -f ~/.ssh/opt1mum_deploy -N ""
ssh-copy-id -i ~/.ssh/opt1mum_deploy.pub ubuntu@164.132.240.78
```

#### 2. Accès Git non interactif sur le VPS (repo privé)

Sur le VPS, créer une clé **deploy** GitHub (read-only) :

```bash
ssh-keygen -t ed25519 -C "vps-opt1mum-git" -f ~/.ssh/github_opt1mum -N ""
cat ~/.ssh/github_opt1mum.pub
```

GitHub → repo → **Settings** → **Deploy keys** → Add (lecture seule).

Sur le VPS :

```bash
# ~/.ssh/config
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_opt1mum
  IdentitiesOnly yes

cd /opt/magazine
git remote set-url origin git@github.com:gauthierntudi/opt1mum-v2.git
git pull
chmod +x deploy/remote-deploy.sh
```

#### 3. Secrets GitHub (repo → Settings → Secrets → Actions)

| Secret | Valeur |
|--------|--------|
| `VPS_HOST` | `164.132.240.78` |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_KEY` | contenu de `~/.ssh/opt1mum_deploy` (clé **privée**) |
| `VPS_PORT` | `22` (optionnel) |

#### 4. Test

Actions → **Deploy production** → **Run workflow**, ou push sur `main`.

Ne jamais committer `.env` ni la clé privée. Le `.env` et `docker-compose.override.yml` restent uniquement sur le VPS.


## 7. Workers BullMQ

- Service `worker` séparé : crash HTTP ≠ crash jobs
- Queues prévues : `email`, `media`, `subscriptions`, `payments`
- Concurrence initiale faible (1–2) pour PDF/images
- Scaling horizontal : 2e Droplet `worker` only, même `REDIS_URL`

## 8. Backups & restore

| Ressource | Stratégie |
|-----------|-----------|
| Postgres | Backups automatiques Managed DO + export ponctuel avant cutover |
| Redis | Acceptable de perdre le cache ; files critiques = retries + état en DB |
| R2 | Versioning bucket si disponible ; copie secondaire optionnelle |
| `.env` | Stocké hors git (1Password / DO secure note) |

Test restore Postgres au moins une fois avant go-live.

## 9. Observabilité minimale

- `docker compose logs -f api worker web`
- Healthchecks : `GET /health` (api), `GET /api/health` côté web si besoin
- UptimeRobot / Better Stack sur `app` + `api`
- Plus tard : Sentry (front + Nest)

## 10. Sécurité

- [ ] SSH clé uniquement, `PasswordAuthentication no`
- [ ] Firewall DO + UFW
- [ ] Secrets hors dépôt
- [ ] Postgres/Redis non exposés public
- [ ] Rate limit Nginx sur `/auth` et webhooks
- [ ] Webhooks Stripe (`/payments/stripe/webhook`) + callback FlexPaie exposés en HTTPS
- [ ] PDF payants : jamais d’URL R2 publique permanente

## 11. Staging

Option A — même Droplet, Compose projet `staging` + ports internes + sous-domaines  
Option B — petit Droplet séparé (préférable dès que budget OK)

Toujours : DB et bucket R2 **séparés** de la prod.

## 12. Cutover DNS

1. Baisser TTL Cloudflare (300s) 24–48h avant
2. Maintenance page courte si freeze écritures
3. ETL final + check
4. Pointer `app` / `api` vers le Droplet
5. Surveiller logs + paiements test
6. Rollback DNS possible tant que legacy tourne

## 13. Coûts approximatifs (ordre de grandeur)

À ajuster selon région / promo DO :

| Élément | Estimation mensuelle |
|---------|----------------------|
| Droplet 8 Go | ~$/mois selon plan |
| Managed Postgres | ~$/mois |
| Managed Redis | ~$/mois |
| R2 | stockage + class A/B ops (souvent faible) |
| Domaine / Resend | variable (domaine `egouv.online` vérifié chez Resend) |

Documenter les montants réels dans un suivi interne une fois les plans choisis.

## 14. Prochaines livrables deploy

- [ ] `docker-compose.yml` + `docker-compose.dev.yml`
- [ ] Dockerfiles `web` et `api`
- [ ] `deploy/nginx/default.conf`
- [ ] `deploy/.env.example`
- [ ] Script `deploy/bootstrap-droplet.sh`
- [ ] (Optionnel) workflow GitHub Actions
