#!/usr/bin/env bash
set -euo pipefail

API_APP_NAME="xlyq-fund-relay-api"
WEB_APP_NAME="xlyq-fund-relay-web"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[xlyq] ERROR: pm2 is not installed"
  exit 1
fi

for app in "$WEB_APP_NAME" "$API_APP_NAME"; do
  if pm2 describe "$app" >/dev/null 2>&1; then
    echo "[xlyq] stopping $app ..."
    pm2 stop "$app"
  else
    echo "[xlyq] $app is not registered in PM2"
  fi
done

pm2 save >/dev/null

echo
pm2 status
