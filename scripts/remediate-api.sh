#!/usr/bin/env bash
# Usage:   npm run remediate:api      (from the repo root)
# Requires in server/.env:
#   LD_API_TOKEN     - Organization settings > Authorization > Create token (Writer role)
#   LD_PROJECT_KEY   - e.g. abc-company   (Projects > your project > key)
#   LD_ENV_KEY       - e.g. production    (the environment your SDK keys belong to)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/server/.env"
FLAG_KEY="${LD_FLAG_KEY:-insights-dashboard}"

if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

for var in LD_API_TOKEN LD_PROJECT_KEY LD_ENV_KEY; do
  if [[ -z "${!var:-}" ]]; then
    echo "$var is not set in server/.env (see server/.env.example)." >&2
    exit 1
  fi
done

echo "Turning OFF flag '$FLAG_KEY' in project '$LD_PROJECT_KEY', environment '$LD_ENV_KEY' via REST API ..."

HTTP_STATUS=$(curl -sS -o /tmp/ld-api-response.json -w '%{http_code}' \
  -X PATCH "https://app.launchdarkly.com/api/v2/flags/$LD_PROJECT_KEY/$FLAG_KEY" \
  -H "Authorization: $LD_API_TOKEN" \
  -H 'Content-Type: application/json; domain-model=launchdarkly.semanticpatch' \
  -d "{\"environmentKey\":\"$LD_ENV_KEY\",\"comment\":\"Manual remediation via scripts/remediate-api.sh\",\"instructions\":[{\"kind\":\"turnFlagOff\"}]}")

echo "HTTP $HTTP_STATUS"
if [[ "$HTTP_STATUS" == "200" ]]; then
  echo "Done. Flag is off; connected clients roll back instantly."
else
  echo "Response:" >&2
  cat /tmp/ld-api-response.json >&2; echo >&2
  exit 1
fi
