# Migration — PHP/MySQL → NestJS/Postgres/R2

Document de référence pour porter le legacy (racine du dépôt) vers `v2/`.

## 1. Inventaire legacy

### Stack actuelle

- PHP (pages + `async/` + `admin/`)
- MySQL/MariaDB (MyISAM, peu de contraintes FK)
- Fichiers locaux : `magazines/`, `magazinefileopti/` (~1.5 Go), `covers/`, `img/`, `profil/`
- Lecteur : `flip/` (turn.js + pdf.js ancien)
- Paiements legacy : MaxiCash, PayPal, MoMo (`config/`) — **remplacés en v2 par Stripe + FlexPaie**

### Tables sources (`database/schema.sql`)

| Table legacy | Domaine | Destination Prisma (cible) |
|--------------|---------|----------------------------|
| `abonne` | Abonnés | `Subscriber` |
| `images_abonne` | Avatar | `Subscriber.avatarKey` ou `Media` |
| `users` | Staff admin | `AdminUser` |
| `magazine` | Numéros | `Magazine` |
| `formuleabonnement` | Offres | `Plan` |
| `abonnement` | Abonnements actifs | `Subscription` |
| `paiement` | Achats unitaires | `Purchase` |
| `actualites` | Articles | `Article` |
| `commentaire` | Commentaires | `Comment` |
| `followers` | Follow catégories | `CategoryFollow` |
| `contact` | Messages contact | `ContactMessage` |
| `pays` | Référentiel pays | `Country` |
| `slide` | Bannières | `Slide` |

## 2. Mapping des champs (principaux)

### `abonne` → `Subscriber`

| Legacy | Nouveau | Notes |
|--------|---------|-------|
| `idAb` | `id` (cuid/uuid) + `legacyId` | Garder `legacyId` pour migration / debug |
| `nomAb` | `name` | |
| `mailAb` | `email` (unique) | Normaliser lowercase |
| `telAb` | `phone` | |
| `mdp` | `passwordHash` | bcrypt `$2y$` compatible |
| `pays` / `codePays` | `country` / `countryCode` | |
| `adresse_physique` | `address` | |
| `codeAb` | `subscriberCode` | |
| `confirmation` OUI/NON | `emailVerifiedAt` | Convertir |
| `codeReinit` / `statusReinit` | tokens dédiés ou table `PasswordReset` | Ne pas stocker en clair long terme |
| `dateAdd` | `createdAt` | |
| `status` | `isActive` | |

### `magazine` → `Magazine`

| Legacy | Nouveau | Notes |
|--------|---------|-------|
| `idmag` | `id` + `legacyId` | |
| `titreMag` | `title` | |
| `description` | `description` | |
| `contenu` | `pdfKey` (R2) | Ancien path fichier → clé R2 |
| `preview` | `previewKey` | |
| `file_download` | `downloadKey` | |
| `coverMag` | `coverKey` | |
| `typeMag` | `accessType` enum `FREE` \| `PAID` | |
| `priceMag` | `priceCents` Int | Montants en centimes |
| `vues` | `viewCount` Int | |
| `numeroMag` | `issueNumber` | |
| `statusMag` | `isPublished` | |
| `dateAdd` | `publishedAt` / `createdAt` | |
| Champs rubriques (`grande_entrevue`, etc.) | `highlights` Json ou table dédiée | À simplifier si possible |
| `bgColor` / `themeColor` | `theme` Json | |

### `actualites` → `Article` + `ArticleBlock`

Pas de table `block_news` en legacy : un article = **une ligne** `actualites`.
En v2, le corps est découpé en **sections** (`ArticleBlock`) ajoutables à la demande :
sous-titre · sous-cover · sous-description (HTML riche).

| Legacy | Nouveau | Notes |
|--------|---------|-------|
| `id` | `id` + `legacyId` | |
| `titre` | `Article.title` | Titre principal |
| `contenu` | `Article.excerpt` (début) | Lead legacy, conservé en tête du chapeau |
| `cover` | `Article.coverKey` (R2) | Cover principale |
| `description` | `Article.excerpt` (texte) + `ArticleBlock.content` (HTML) | Corps legacy : texte intégral dans le chapeau (pas de troncature) + HTML en 1ʳᵉ section |
| `categorie` | `category` | |
| `vues` | `viewCount` | |
| `status` | `isPublished` | |
| `dateAdd` | `publishedAt` / `createdAt` | |
| `idRedaction` | `authorId` | |
| — | `ArticleBlock.title` | Sous-titre (optionnel) |
| — | `ArticleBlock.coverKey` | Sous-cover (optionnelle) |
| — | `ArticleBlock.content` | Sous-description HTML + éditeur riche |
| — | `ArticleBlock.position` | Ordre d’affichage |
| — | `slug` | Généré depuis le titre |

`Article.content` reste un miroir concaténé des blocs (recherche / compat).
Admin : bouton **Ajouter une section** pour empiler autant de blocs que nécessaire.

### `abonnement` → `Subscription`

| Legacy | Nouveau | Notes |
|--------|---------|-------|
| `idabonnement` | `id` + `legacyId` | |
| `id_Abonne` | `subscriberId` | Résoudre via `legacyId` |
| `id_Formule` | `planId` | |
| `typeAbonnement` / `pricingAbonnement` | dérivés du `Plan` | Éviter duplication |
| `statusPaiement` | `paymentStatus` enum | |
| `referenceTransactions` | `transactionRef` | |
| `dateAdd` / `dateExp` | `startsAt` / `expiresAt` | |
| `statusAbonnement` | `status` enum `ACTIVE` \| `EXPIRED` \| `CANCELLED` | |

### `paiement` → `Purchase`

Achat à l’unité d’un magazine (hors abo).

| Legacy | Nouveau |
|--------|---------|
| `id_Abonne` | `subscriberId` |
| `id_Mag` | `magazineId` |
| `price_Mag` | `amountCents` |
| `referenceTransactions` | `transactionRef` |
| `statusPaiement` | `paymentStatus` |
| `dateAdd` | `createdAt` |

## 3. Domaines fonctionnels à porter

### Priorité P0 — cutover viable

- [ ] Auth abonné (register, login, confirm email, reset password)
- [ ] Auth admin
- [ ] Catalogue magazines (kiosque) + covers R2
- [ ] Lecture PDF (PDF.js) avec contrôle d’accès (abo / achat / gratuit)
- [ ] Formules + souscription
- [ ] Achats unitaires
- [ ] Paiements : Stripe (carte) + FlexPaie (mobile) + webhooks/callbacks
- [ ] Admin : CRUD magazines + upload PDF/cover

### Priorité P1

- [ ] Actualités + commentaires
- [ ] Profil abonné + avatar
- [ ] Renouvellement abo (job BullMQ)
- [ ] Emails transactionnels via **Resend** (activation, facture, reset)
- [ ] Google login (présent en legacy `async/google_login.php`)

### Priorité P2

- [ ] Followers / catégories
- [ ] Contact form
- [ ] Slides / pubs
- [ ] Notifications in-app
- [ ] Newsletter
- [ ] RSS / sitemap

## 4. Migration des données

### Prérequis

1. Schéma Prisma finalisé et migré sur Postgres managed
2. Script ETL (Node/TS) : MySQL source → Postgres cible
3. Mapping `legacyId` → nouveaux IDs pour toutes les FK

### Étapes ETL

1. **Référentiels** : `pays`, `formuleabonnement` → `Country`, `Plan`
2. **Users** : `abonne`, `users`, `images_abonne`
3. **Contenu** : `magazine`, `actualites`, `slide`
4. **Transactions** : `abonnement`, `paiement`
   - Script abonnements : `pnpm --filter @studrc/api migrate:subscriptions`
   - Migre `formuleabonnement` → `Plan`, `abonnement` → `Subscription` (+ paiements `LEGACY` optionnels)
   - Prérequis : `pnpm migrate:mysql` (abonnés avec `legacyId`)
5. **Social** : `commentaire`, `followers`, `contact`
6. **Vérification** : counts, spot-checks, abonnements encore actifs

### Règles

- Conserver les hash bcrypt tels quels
- Convertir dates invalides / NULL proprement
- Normaliser emails (trim + lowercase)
- Remplacer chemins fichiers par clés R2 **après** upload médias
- Idempotence : relancer le script sans doubler (`legacyId` unique)

### Script

```
v2/apps/api/scripts/migrate-from-mysql.ts      # abonnés
v2/apps/api/scripts/migrate-magazines-from-mysql.ts  # magazines
v2/apps/api/scripts/migrate-articles-from-mysql.ts   # actualités → Article + ArticleBlock
v2/apps/api/scripts/migrate-articles-to-r2.ts        # covers articles/ → R2 articles/
```

Sources :

1. `LEGACY_MYSQL_URL` (live MySQL) — nécessite `pnpm --filter @studrc/api add mysql2`
2. Sinon `LEGACY_SQL_DUMP` ou le dump du dépôt `database/schema.sql`

Variables :

```
DATABASE_URL=postgresql://…          # Postgres cible
LEGACY_MYSQL_URL=mysql://…           # optionnel
LEGACY_SQL_DUMP=/chemin/dump.sql     # optionnel
ARTICLES_DIR=/chemin/vers/articles   # optionnel (défaut : MAGAZINE/articles)
```

Commandes (depuis `v2/apps/api`) :

```bash
# Aperçu sans écriture
pnpm migrate:mysql -- --dry-run
pnpm migrate:magazines -- --dry-run
pnpm migrate:articles -- --dry-run

# Import — conserve les hash bcrypt ($2y$) → login possible avec l’ancien MDP
pnpm migrate:mysql

# Magazines (titre, cover, PDF/flip, prix, highlights, thème)
pnpm migrate:magazines

# Actualités (titre, chapeau, description → 1 section, coverKey)
pnpm migrate:articles
pnpm migrate:articles-r2              # upload covers → R2 + réécrit coverKey
pnpm migrate:articles-r2 -- --skip-existing

# Import emails seulement (hash factice) → reset OTP obligatoire
pnpm migrate:mysql -- --force-reset
```

Idempotent via `legacyId` / email unique. Les comptes déjà créés en v2 sont seulement rattachés (`legacyId`), sans écraser leur mot de passe.

## 5. Migration des médias → Cloudflare R2

### Sources locales

| Dossier legacy | Cible R2 | Volume approx. |
|----------------|----------|----------------|
| `magazinefileopti/` | `magazines/` | ~1.5 Go |
| `magazines/` | `magazines/` (complément) | ~169 Mo |
| `covers/` | `covers/` | ~14 Mo |
| `articles/` | `articles/` | covers actualités |
| `img/` | `assets/` | ~56 Mo |
| `profil/` | `profil/` | variable |

### Processus

1. Script `migrate-magazines-to-r2.ts` : upload covers + PDFs → R2, réécrit `coverKey` / `downloadKey`
2. Script `migrate-articles-to-r2.ts` : upload `articles/` → R2 `articles/`, réécrit `Article.coverKey`
3. Script `migrate-profiles-to-r2.ts` : avatars → `profil/`
4. Vérifier accès public CDN (`R2_PUBLIC_URL`)
5. Garder une copie locale/backup jusqu’à validation prod

```bash
cd v2/apps/api
pnpm migrate:magazines-r2 -- --dry-run
pnpm migrate:magazines-r2 -- --skip-existing
pnpm migrate:articles-r2 -- --dry-run
pnpm migrate:articles-r2 -- --skip-existing
```

### Jobs post-upload (BullMQ)

- Génération variantes images (thumb cover)
- Validation PDF (page count, taille)
- Optionnel : extraction preview pages

## 6. Paiements

### Legacy (ne pas porter)

- MaxiCash (`documentation/`, `config/maxicash_helpers.php`)
- PayPal (`config/paypal_checkout.php`)
- MoMo (`config/momo_providers.php`, assets JS)

Les historiques `abonnement` / `paiement` sont migrés en lecture (statut, montants, refs). Les **nouveaux** encaissements utilisent uniquement les providers v2.

### v2 — providers

| Canal | Provider | Intégration |
|-------|----------|-------------|
| Carte | **Stripe** | Payment Intents / Checkout Session, Customer pour abonnés, webhooks `payment_intent.*` / `checkout.session.*` |
| Mobile Money | **FlexPaie** | API marchand + callback URL, paiement via téléphone (réseaux locaux) |

Règles communes Nest :

- Table `Payment` unifiée : `provider` (`STRIPE` \| `FLEXPAIE`), `providerRef`, `amountCents`, `currency`, `status`, `purpose` (`SUBSCRIPTION` \| `PURCHASE`)
- Créer l’enregistrement `PENDING` **avant** d’appeler le provider
- Webhooks / callbacks **idempotents** (ignorer doublons via `providerRef`)
- Vérifier signatures Stripe (`stripe-signature`) ; valider callbacks FlexPaie selon leur doc marchand
- Jobs BullMQ : activation abo / achat + email après `SUCCESS`

Devises : USD / CDF selon offre — aligner Stripe et FlexPaie sur la même stratégie de prix (centimes / unités provider).

## 7. Lecteur PDF

| Legacy | v2 |
|--------|-----|
| `flip/` + turn.js | PDF.js (viewer custom Next) |
| Fichier local / path serveur | Stream ou URL signée R2 via API |
| Contrôle d’accès PHP session | Guard Nest + cookie/JWT côté web |

## 8. Stratégie de cutover

1. **Freeze écritures** court (maintenance) ou dual-write temporaire
2. ETL final + sync médias delta
3. Basculer DNS (Cloudflare) vers le Droplet v2
4. Garder legacy en lecture seule 1–2 semaines
5. Désactiver legacy après validation

### Critères de go-live

- [ ] Login abonnés existants OK (mêmes mots de passe)
- [ ] Abonnements actifs respectés
- [ ] PDF payants inaccessibles sans droit
- [ ] Paiement test Stripe (test mode) OK
- [ ] Paiement test FlexPaie (sandbox / période de tests) OK
- [ ] Admin peut publier un nouveau numéro (upload R2)
- [ ] Backups Postgres + Redis OK
- [ ] Monitoring basique (uptime, erreurs API)

## 9. Risques

| Risque | Mitigation |
|--------|------------|
| FK legacy en `varchar` / orphelins | ETL tolérant + rapport d’erreurs |
| PDF manquants | Inventaire avant cutover |
| Webhooks paiement pendant migration | Fenêtre maintenance ou file d’attente |
| Downtime DNS | TTL Cloudflare bas avant bascule |
| Perf PDF sur mobile | PDF.js + range requests R2 |

## 10. Ordre d’exécution recommandé

1. Scaffold monorepo + Docker local
2. Schéma Prisma + seed Plans
3. Auth + Magazines API
4. Upload R2 + lecteur PDF
5. Subscriptions + Payments (Stripe carte + FlexPaie mobile)
6. Script ETL données
7. Script médias R2
8. Frontend public + admin minimum
9. Staging sur Droplet
10. Cutover prod
