#!/usr/bin/env bash
set -u

APP_NAME="xlyq-fund-relay-api"
HEALTH_URL="http://127.0.0.1:3100/api/v1/health"

printf '%s\n' '=============================='
printf '%s\n' ' xlyq-fund-relay status'
printf '%s\n' '=============================='

if command -v pm2 >/dev/null 2>&1; then
  echo
  echo '[PM2]'
  pm2 status "$APP_NAME" 2>/dev/null || pm2 status
else
  echo
  echo '[PM2] not installed'
fi

echo
echo '[API health]'
if command -v curl >/dev/null 2>&1; then
  if RESPONSE="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null)"; then
    echo "OK: $HEALTH_URL"
    echo "$RESPONSE"
  else
    echo "FAIL: $HEALTH_URL"
  fi
else
  echo 'curl is not installed'
fi

echo
echo '[Port 3100]'
if command -v ss >/dev/null 2>&1; then
  ss -lntp 2>/dev/null | grep ':3100' || echo 'port 3100 is not listening'
elif command -v netstat >/dev/null 2>&1; then
  netstat -lntp 2>/dev/null | grep ':3100' || echo 'port 3100 is not listening'
else
  echo 'ss/netstat unavailable'
fi

echo
echo '[Nginx]'
if command -v nginx >/dev/null 2>&1; then
  nginx -v 2>&1
  if command -v systemctl >/dev/null 2>&1; then
    systemctl is-active nginx 2>/dev/null || true
  fi
else
  echo 'nginx is not installed'
fi
