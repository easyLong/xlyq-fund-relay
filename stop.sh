#!/usr/bin/env bash
set -euo pipefail

APP_NAME="xlyq-fund-relay-api"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[xlyq] ERROR: pm2 is not installed"
  exit 1
fi

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  echo "[xlyq] stopping $APP_NAME ..."
  pm2 stop "$APP_NAME"
  pm2 save >/dev/null
  echo "[xlyq] stopped"
else
  echo "[xlyq] $APP_NAME is not registered in PM2"
fi

echo
pm2 status "$APP_NAME" 2>/dev/null || pm2 status
