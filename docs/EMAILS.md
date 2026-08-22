# Emails — Resend

Provider email retenu pour **MAGAZINE v2** : [Resend](https://resend.com).

Pas de SMTP classique. Envoi via API Resend depuis NestJS, idéalement passé par une queue **BullMQ** (`email`).

## Variables

```bash
RESEND_API_KEY=re_...
MAIL_FROM=STUDRC <noreply@studrc.com>
```

## Setup Resend (checklist)

1. [ ] Compte Resend + créer une API key
2. [ ] Ajouter le domaine `studrc.com` dans Resend
3. [ ] Configurer les DNS (SPF, DKIM, éventuellement DMARC) selon Resend
4. [ ] Attendre la vérification du domaine
5. [ ] Coller `RESEND_API_KEY` dans `v2/.env`
6. [ ] Expéditeur : adresse d’un domaine vérifié (`noreply@studrc.com`)

Sans domaine vérifié, Resend limite souvent l’envoi (ex. uniquement vers ton email de compte).

## Usages prévus

| Email | Déclencheur |
|-------|-------------|
| Confirmation d’inscription | Register |
| Reset password | Demande de réinit |
| Confirmation paiement / facture | Webhook Stripe ou callback FlexPaie `SUCCESS` — **implémenté** (`MailService.sendPaymentConfirmation`) |
| Abonnement activé / expiré | Jobs subscriptions |
| Contact / admin | Formulaire contact (P2) |

## Architecture

```
Nest service (MailService)
    → job BullMQ `email`
        → Resend API (SDK `resend`)
```

Avantages de la queue : retry, pas de latence HTTP bloquante, isolation des erreurs Resend.

## Implémentation Nest (cible)

```ts
// package: resend
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: process.env.MAIL_FROM!, // STUDRC <noreply@studrc.com>
  to: user.email,
  subject: '...',
  html: '...', // ou React Email plus tard
});
```

Templates : HTML simples au début ; optionnel plus tard [React Email](https://react.email) + Resend.

## Sécurité

- Ne jamais committer `RESEND_API_KEY`
- Rate-limit les endpoints qui déclenchent un email :
  - `POST /auth/resend-verification` : cooldown **60 s** / compte, max **5 / h** ; throttle IP Nest **5 / 15 min**
  - `POST /auth/forgot-password` : throttle IP Nest **5 / 15 min**
  - `POST /auth/login`, `/register`, `/google`, `/auth/admin/login` : throttle IP Nest **10 / 15 min**
- Logs : stocker `resendId` / message id, pas le corps complet des mails sensibles
