#!/usr/bin/env bash
# Déploiement prod sur le VPS — GitHub Actions ou manuel.
# Ne jamais `git clean` : .env, docker-compose.override.yml, certbot et
# deploy/nginx/local/*.conf restent hors git.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/magazine}"
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "ERREUR : $APP_DIR/.env introuvable — abort (secrets hors git)."
  exit 1
fi

echo "==> git sync origin/main"
git remote set-url origin git@github.com:gauthierntudi/studrc.git
git fetch origin main
git reset --hard origin/main
chmod +x deploy/remote-deploy.sh

echo "==> docker compose build (api, web, worker)"
docker compose build api web worker

echo "==> docker compose up (sans recréer postgres/redis)"
docker compose up -d --no-deps --force-recreate api web worker

echo "==> prisma migrate deploy"
docker compose exec -T api npx prisma migrate deploy

echo "==> recreate nginx (DNS upstream Docker)"
docker compose up -d --no-deps --force-recreate nginx

echo "==> healthcheck"
ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if docker compose exec -T api node -e \
    "fetch('http://127.0.0.1:3001/api/health').then(async (r)=>{const t=await r.text(); if(!r.ok||!t.includes('\"status\":\"ok\"')) process.exit(1); console.log(t);}).catch(()=>process.exit(1))"; then
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" -eq 1 ]]; then
  echo "OK — API healthy"
else
  echo "WARN — healthcheck API a échoué (vérifier les logs)"
  docker compose ps
  docker compose logs api --tail 50
  exit 1
fi
