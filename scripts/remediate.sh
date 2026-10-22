#!/usr/bin/env bash
# Usage:   npm run remediate            (from the repo root)
#    or:   bash scripts/remediate.sh
# Requires LD_TRIGGER_URL in server/.env (a flag trigger on insights-dashboard with action "Turn flag off").
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/server/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

if [[ -z "${LD_TRIGGER_URL:-}" ]]; then
  echo "LD_TRIGGER_URL is not set." >&2
  echo "Create a Generic trigger (action: Turn flag off) on the flag in LaunchDarkly and put its URL in server/.env." >&2
  echo "If your plan does not include flag triggers, use the REST API fallback: npm run remediate:api" >&2
  exit 1
fi

echo "Firing LaunchDarkly flag trigger to turn OFF insights-dashboard ..."

HTTP_STATUS=$(curl -sS -o /tmp/ld-trigger-response.txt -w '%{http_code}' \
  -X POST "$LD_TRIGGER_URL" \
  -H 'Content-Type: application/json' \
  -d '{"eventName":"Manual remediation via scripts/remediate.sh","url":"http://localhost:5173"}')

echo "HTTP $HTTP_STATUS"
if [[ -s /tmp/ld-trigger-response.txt ]]; then cat /tmp/ld-trigger-response.txt; echo; fi

if [[ "$HTTP_STATUS" == "200" || "$HTTP_STATUS" == "201" || "$HTTP_STATUS" == "204" ]]; then
  echo "Done. Watch the dashboard roll back to the usage table without a reload."
else
  echo "Trigger call did not succeed. If the URL was reset in LaunchDarkly, update server/.env." >&2
  exit 1
fi
