#!/usr/bin/env bash
set -u

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

API_PORT=""
WEB_PORT=""
if [ -f "$ENV_FILE" ]; then
  API_PORT="$(read_env_value API_PORT)"
  WEB_PORT="$(read_env_value WEB_PORT)"
fi

printf '%s\n' '=============================='
printf '%s\n' ' xlyq-fund-relay status'
printf '%s\n' '=============================='
echo "config: $ENV_FILE"
echo "API_PORT=${API_PORT:-not configured}"
echo "WEB_PORT=${WEB_PORT:-not configured}"

if command -v pm2 >/dev/null 2>&1; then
  echo
  echo '[PM2]'
  pm2 status
else
  echo
  echo '[PM2] not installed'
fi

if [ -n "$API_PORT" ]; then
  API_HEALTH_URL="http://127.0.0.1:${API_PORT}/api/v1/health"
  echo
  echo '[API health]'
  if command -v curl >/dev/null 2>&1 && RESPONSE="$(curl -fsS --max-time 5 "$API_HEALTH_URL" 2>/dev/null)"; then
    echo "OK: $API_HEALTH_URL"
    echo "$RESPONSE"
  else
    echo "FAIL: $API_HEALTH_URL"
  fi
fi

if [ -n "$WEB_PORT" ]; then
  WEB_URL="http://127.0.0.1:${WEB_PORT}/"
  echo
  echo '[Web health]'
  if command -v curl >/dev/null 2>&1 && curl -fsS --max-time 5 "$WEB_URL" >/dev/null 2>&1; then
    echo "OK: $WEB_URL"
  else
    echo "FAIL: $WEB_URL"
  fi
fi

echo
echo '[Ports]'
if command -v ss >/dev/null 2>&1; then
  if [ -n "$API_PORT" ]; then
    ss -lntp 2>/dev/null | grep ":${API_PORT}" || echo "port $API_PORT is not listening"
  fi
  if [ -n "$WEB_PORT" ]; then
    ss -lntp 2>/dev/null | grep ":${WEB_PORT}" || echo "port $WEB_PORT is not listening"
  fi
elif command -v netstat >/dev/null 2>&1; then
  if [ -n "$API_PORT" ]; then
    netstat -lntp 2>/dev/null | grep ":${API_PORT}" || echo "port $API_PORT is not listening"
  fi
  if [ -n "$WEB_PORT" ]; then
    netstat -lntp 2>/dev/null | grep ":${WEB_PORT}" || echo "port $WEB_PORT is not listening"
  fi
else
  echo 'ss/netstat unavailable'
fi
