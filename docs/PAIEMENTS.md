# Paiements — Stripe (live) + FlexPaie

Providers retenus pour **MAGAZINE v2** (le legacy MaxiCash / PayPal / MoMo n’est pas porté).

| Canal | Provider | Public cible |
|-------|----------|--------------|
| Carte bancaire | [Stripe](https://stripe.com) **Live** | International / cartes |
| Mobile Money | FlexPaie / FlexPay | RDC / réseaux mobiles locaux |

## Décision d’environnement

**Stripe est utiliséé uniquement en mode Live (production).**  
Les clés commencent par `sk_live_` / `pk_live_`. Pas de mode test Stripe sur ce projet.

Conséquence : tout paiement réel débite une vraie carte. Pendant le développement, utiliser des montants minimaux et des remboursements immédiats si besoin.

## Modèle métier unifié

Une seule entité `Payment` côté Prisma / Nest, quel que soit le canal :

```
Payment
├── id
├── provider          STRIPE | FLEXPAIE
├── providerRef       id externe (PaymentIntent, order FlexPaie…)
├── amountCents
├── currency          USD | CDF | …
├── status            PENDING | SUCCESS | FAILED | CANCELLED | REFUNDED
├── purpose           SUBSCRIPTION | PURCHASE
├── subscriberId
├── planId?           si abonnement
├── magazineId?       si achat unitaire
├── metadata          Json
├── createdAt
└── updatedAt
```

Règle d’or : **toujours** créer `PENDING` en base avant d’appeler le provider.

## Stripe (carte) — Live

### Secrets

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Créer le webhook (Dashboard Live)

1. [Dashboard Stripe](https://dashboard.stripe.com) — désactiver **Test mode** (toggle en haut à droite)
2. **Developers** → **Webhooks** → **Add endpoint**
3. **Endpoint URL** (prod) :
   ```
   https://api.egouv.online/payments/stripe/webhook
   ```
4. Événements à écouter :
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - (plus tard) `charge.refunded`
5. **Add endpoint** → ouvrir l’endpoint → **Reveal** le **Signing secret** (`whsec_…`)
6. Coller dans `v2/.env` → `STRIPE_WEBHOOK_SECRET`

Le webhook ne pourra être validé qu’une fois l’API Nest déployée en HTTPS. Avant ça, tu peux déjà créer l’endpoint et garder le `whsec_` prêt.

### Flux (Payment Element — reste sur le site)

1. Client choisit formule → `POST /payments/stripe/create`
2. API crée `Payment PENDING` + `PaymentIntent` → renvoie `clientSecret`
3. Front affiche le Payment Element (carte) dans une modale Opt1mum
4. `stripe.confirmPayment` (3DS si besoin, `redirect: if_required`)
5. `POST /payments/stripe/confirm` avec `paymentIntentId` + webhook `payment_intent.succeeded`
6. Activation `Subscription` / `Purchase`

Événements webhook à écouter : `payment_intent.succeeded`, `payment_intent.payment_failed` (legacy Checkout encore géré si présent).

### Sécurité

- Vérifier `stripe-signature` (raw body) sur chaque webhook
- Ne jamais activer l’abo uniquement sur le retour browser
- Clés live uniquement ; ne jamais committer `.env`

## FlexPaie (mobile)

Credentials déjà présents dans `v2/.env` (marchand + API FlexPay).

### Variables

```bash
FLEXPAIE_MERCHANT=
FLEXPAIE_TOKEN=Bearer ...
FLEXPAIE_MOBILE_API_URL=https://backend.flexpay.cd/api/rest/v1/paymentService
FLEXPAIE_CARD_API_URL=https://cardpayment.flexpay.cd/v1.1/pay
FLEXPAIE_CHECK_API_URL=https://backend.flexpay.cd/api/rest/v1/check
FLEXPAIE_CALLBACK_URL=https://api.egouv.online/payments/flexpaie/callback
```

> En prod, `FLEXPAIE_CALLBACK_URL` doit être une URL **HTTPS publique**, pas `localhost`.

### Flux

1. Client choisit mobile → saisit téléphone → `POST /payments/flexpaie/create`
2. API crée `Payment PENDING` + appel `FLEXPAIE_MOBILE_API_URL`
3. Abonné valide sur son mobile
4. Callback FlexPaie → validation (éventuellement `CHECK_API`) → `SUCCESS`
5. Job BullMQ : email

### Sécurité

- Valider l’authenticité du callback selon la doc marchand
- Idempotence sur la référence transaction
- Timeout → `FAILED` si pas de confirmation

## Front (Next.js)

- Sélecteur : **Carte (Stripe)** | **Mobile (FlexPaie)**
- Stripe.js avec `pk_live_…`
- FlexPaie : téléphone + attente confirmation mobile
- Polling statut `Payment` en complément du webhook

## Admin

- Liste filtrable par provider / statut
- Lien dashboard Stripe (Live) pour un PaymentIntent
- Référence FlexPaie pour le support

## Migration des historiques

| Legacy | Action v2 |
|--------|-----------|
| MaxiCash / PayPal / MoMo réussis | Migrés sur `Subscription` / `Purchase` (pas rejoués) |
| Paiements `NO_FINISH` | `CANCELLED` / ignorés |
| Nouveaux encaissements | Stripe live ou FlexPaie uniquement |

## Checklist

- [ ] Clés Stripe **live** dans `.env`
- [ ] Endpoint webhook Stripe Live créé + `whsec_` enregistré
- [ ] Credentials FlexPaie + callback HTTPS prod
- [x] Module Nest `payments`
- [x] UI checkout dual-canal
- [ ] Premier paiement live de validation (montant min + remboursement si besoin)
- [ ] Runbook support (remboursement Stripe / litige FlexPaie)
