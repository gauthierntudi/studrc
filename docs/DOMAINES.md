# Domaines

## Production

| Hôte | Rôle |
|------|------|
| `studrc.com` / `www.studrc.com` | Front Next.js |
| `api.studrc.com` | NestJS + webhooks Stripe / FlexPaie |
| `cdn.studrc.com` (optionnel) | Médias R2 |

Webhook Stripe : `https://api.studrc.com/payments/stripe/webhook`  
Callback FlexPaie : `https://api.studrc.com/payments/flexpaie/callback`

## Checklist de cutover

1. [ ] DNS Cloudflare `studrc.com` → Droplet
2. [ ] Mettre à jour `.env` (`APP_URL`, `API_URL`, `COOKIE_DOMAIN`, callbacks)
3. [ ] Nginx `server_name`
4. [ ] Recréer webhook Stripe + callback FlexPaie sur les nouvelles URLs
5. [ ] Vérifier domaine Resend (`noreply@studrc.com`)
6. [ ] Certificat Let’s Encrypt pour `studrc.com` / `www` / `api`
