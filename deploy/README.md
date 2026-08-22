# Deploy artifacts

Configs DigitalOcean (Docker Compose, Nginx, env).

Voir : [../docs/DEPLOIEMENT.md](../docs/DEPLOIEMENT.md) · [../docs/DOMAINES.md](../docs/DOMAINES.md)

Fichiers :

- `nginx/default.conf` — reverse proxy `studrc.com` + `api.studrc.com`
- `.env.example` — modèle des variables
- Certbot volumes : `certbot/conf`, `certbot/www` (créés au premier SSL)
