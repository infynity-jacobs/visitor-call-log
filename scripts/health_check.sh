#!/usr/bin/env bash
# scripts/health_check.sh
#
# Verifies the application is up and can reach its database.
# Exits 0 on success, non-zero on failure — suitable for install/update
# scripts, cron, or an external uptime monitor.
#
# Usage: ./scripts/health_check.sh [url]   (default: http://localhost:3000/api/health)

set -euo pipefail

URL="${1:-http://localhost:3000/api/health}"
EXPECTED_VERSION="${2:-}"
MAX_ATTEMPTS=10
SLEEP_SECONDS=2

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  RESPONSE="$(curl -fsS --max-time 5 "$URL" 2>/dev/null || true)"

  if [[ -n "$RESPONSE" ]] && echo "$RESPONSE" | grep -q '"status":"ok"' && echo "$RESPONSE" | grep -q '"db":true'; then
    if [[ -n "$EXPECTED_VERSION" ]] && ! echo "$RESPONSE" | grep -q "\"version\":\"${EXPECTED_VERSION}\""; then
      echo "Attempt $attempt/$MAX_ATTEMPTS: application is healthy but reports the wrong version (expected $EXPECTED_VERSION): $RESPONSE. Retrying in ${SLEEP_SECONDS}s..."
      sleep "$SLEEP_SECONDS"
      continue
    fi
    echo "Health check passed: $RESPONSE"
    exit 0
  fi

  echo "Attempt $attempt/$MAX_ATTEMPTS: not healthy yet ($RESPONSE). Retrying in ${SLEEP_SECONDS}s..."
  sleep "$SLEEP_SECONDS"
done

echo "ERROR: health check failed after $MAX_ATTEMPTS attempts against $URL" >&2
exit 1
