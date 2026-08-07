# Domaines

## Actuel (staging / go-live)

| Hôte | Rôle |
|------|------|
| `egouv.online` / `www.egouv.online` | Front Next.js |
| `api.egouv.online` | NestJS + webhooks Stripe / FlexPaie |
| `cdn.egouv.online` (optionnel) | Médias R2 |

Webhook Stripe : `https://api.egouv.online/payments/stripe/webhook`  
Callback FlexPaie : `https://api.egouv.online/payments/flexpaie/callback`

## Cible plus tard

Basculer vers **`opt1mum.com`** (et `api.opt1mum.com`, `cdn.opt1mum.com`) une fois prêt.

Checklist de bascule :

1. [ ] DNS Cloudflare `opt1mum.com` → Droplet
2. [ ] Mettre à jour `.env` (`APP_URL`, `API_URL`, `COOKIE_DOMAIN`, callbacks)
3. [ ] Nginx `server_name`
4. [ ] Recréer webhook Stripe + callback FlexPaie sur les nouvelles URLs
5. [ ] Vérifier domaine Resend (`noreply@opt1mum.com`)
6. [ ] Rediriger `egouv.online` → `opt1mum.com` (301)
