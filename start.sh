#!/usr/bin/env bash
set -euo pipefail

API_APP_NAME="xlyq-fund-relay-api"
WEB_APP_NAME="xlyq-fund-relay-web"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.env"

read_env_value() {
  local key="$1"
  local line
  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$ENV_FILE" | tail -n 1 || true)"
  local value="${line#*=}"
  value="$(printf '%s' "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
  printf '%s' "$value"
}

cd "$ROOT_DIR"

echo "[xlyq] project: $ROOT_DIR"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[xlyq] ERROR: pm2 is not installed. Run: npm install -g pm2"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "[xlyq] ERROR: $ENV_FILE not found"
  exit 1
fi

API_PORT="$(read_env_value API_PORT)"
WEB_PORT="$(read_env_value WEB_PORT)"

if ! [[ "$API_PORT" =~ ^[0-9]+$ ]] || ! [[ "$WEB_PORT" =~ ^[0-9]+$ ]]; then
  echo "[xlyq] ERROR: API_PORT and WEB_PORT must be configured in .env"
  echo "[xlyq] Example: API_PORT=3100, WEB_PORT=8080"
  exit 1
fi

if [ "$API_PORT" = "$WEB_PORT" ]; then
  echo "[xlyq] ERROR: API_PORT and WEB_PORT cannot be the same"
  exit 1
fi

echo "[xlyq] API_PORT=$API_PORT"
echo "[xlyq] WEB_PORT=$WEB_PORT"

if [ ! -d "$ROOT_DIR/apps/api/dist" ] || [ ! -d "$ROOT_DIR/apps/web/dist" ]; then
  echo "[xlyq] build output not found, building project..."
  npm run build
fi

if pm2 describe "$API_APP_NAME" >/dev/null 2>&1; then
  echo "[xlyq] restarting $API_APP_NAME ..."
  pm2 restart "$API_APP_NAME" --update-env
else
  echo "[xlyq] starting $API_APP_NAME ..."
  pm2 start npm --name "$API_APP_NAME" -- run start -w @xlyq/api
fi

if pm2 describe "$WEB_APP_NAME" >/dev/null 2>&1; then
  echo "[xlyq] restarting $WEB_APP_NAME ..."
  pm2 restart "$WEB_APP_NAME" --update-env
else
  echo "[xlyq] starting $WEB_APP_NAME ..."
  pm2 start npm --name "$WEB_APP_NAME" -- run preview -w @xlyq/web
fi

pm2 save >/dev/null

sleep 2

echo
pm2 status

echo
API_HEALTH_URL="http://127.0.0.1:${API_PORT}/api/v1/health"
WEB_URL="http://127.0.0.1:${WEB_PORT}/"

if curl -fsS --max-time 5 "$API_HEALTH_URL" >/dev/null 2>&1; then
  echo "[xlyq] API health: OK  $API_HEALTH_URL"
else
  echo "[xlyq] API health: NOT READY  $API_HEALTH_URL"
  echo "[xlyq] Check logs: pm2 logs $API_APP_NAME --lines 100"
fi

if curl -fsS --max-time 5 "$WEB_URL" >/dev/null 2>&1; then
  echo "[xlyq] Web: OK  $WEB_URL"
else
  echo "[xlyq] Web: NOT READY  $WEB_URL"
  echo "[xlyq] Check logs: pm2 logs $WEB_APP_NAME --lines 100"
fi

echo
echo "[xlyq] Public access: http://<SERVER_PUBLIC_IP>:${WEB_PORT}/"
