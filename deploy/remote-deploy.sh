#!/usr/bin/env bash
# Déploiement prod sur le VPS — appelé par GitHub Actions ou manuellement.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/magazine}"
cd "$APP_DIR"

echo "==> git pull"
git fetch origin main
git pull --ff-only origin main

echo "==> docker compose build (api, web, worker)"
docker compose build api web worker

echo "==> docker compose up"
docker compose up -d api web worker

echo "==> prisma migrate deploy"
docker compose exec -T api npx prisma migrate deploy

echo "==> recreate nginx (DNS upstream Docker)"
docker compose up -d --force-recreate nginx

echo "==> healthcheck"
sleep 2
if docker compose exec -T api wget -qO- http://127.0.0.1:3001/api/health | grep -q '"status":"ok"'; then
  echo "OK — API healthy"
else
  echo "WARN — healthcheck API a échoué (vérifier les logs)"
  docker compose ps
  exit 1
fi
