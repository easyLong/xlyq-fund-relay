#!/usr/bin/env bash
set -euo pipefail

APP_NAME="xlyq-fund-relay-api"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

echo "[xlyq] project: $ROOT_DIR"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[xlyq] ERROR: pm2 is not installed. Run: npm install -g pm2"
  exit 1
fi

if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "[xlyq] WARNING: $ROOT_DIR/.env not found"
fi

if [ ! -d "$ROOT_DIR/apps/api/dist" ]; then
  echo "[xlyq] API build output not found, building project..."
  npm run build
fi

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  echo "[xlyq] restarting $APP_NAME ..."
  pm2 restart "$APP_NAME" --update-env
else
  echo "[xlyq] starting $APP_NAME ..."
  pm2 start npm --name "$APP_NAME" -- run start -w @xlyq/api
fi

pm2 save >/dev/null

echo
pm2 status "$APP_NAME" || pm2 status

echo
if curl -fsS --max-time 5 http://127.0.0.1:3100/api/v1/health >/dev/null 2>&1; then
  echo "[xlyq] API health: OK  http://127.0.0.1:3100/api/v1/health"
else
  echo "[xlyq] API health: NOT READY"
  echo "[xlyq] Check logs with: pm2 logs $APP_NAME --lines 100"
fi

if command -v nginx >/dev/null 2>&1; then
  if systemctl is-active --quiet nginx 2>/dev/null; then
    echo "[xlyq] Nginx: running"
  else
    echo "[xlyq] Nginx: not running"
  fi
fi
