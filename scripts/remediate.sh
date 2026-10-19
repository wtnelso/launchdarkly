#!/usr/bin/env bash
#
# Remediate: turn the `insights-dashboard` flag OFF via a LaunchDarkly flag trigger.
#
# A flag trigger is a unique, unguessable webhook URL that LaunchDarkly gives you
# per flag + environment. POSTing to it performs the trigger's action (here:
# "Turn flag off"). Every SDK connected to that environment - the React app in
# each browser and the Node API - receives the change over its streaming
# connection and rolls back within about a second. No deploy, no reload.
#
# Usage:   npm run remediate            (from the repo root)
#    or:   bash scripts/remediate.sh
#
# Requires LD_TRIGGER_URL in server/.env (see server/.env.example for how to
# create the trigger). No API token is needed - the URL itself is the secret.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/server/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

if [[ -z "${LD_TRIGGER_URL:-}" ]]; then
  echo "LD_TRIGGER_URL is not set." >&2
  echo "Create a Generic trigger (action: Turn flag off) on the flag in LaunchDarkly and put its URL in server/.env." >&2
  echo "If your plan does not include flag triggers, use the REST API fallback: npm run remediate:api" >&2
  exit 1
fi

echo "Firing LaunchDarkly flag trigger to turn OFF insights-dashboard ..."

# The JSON body is optional. eventName/url are recorded in the flag's change
# history so an auditor can see *why* the flag was turned off.
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
