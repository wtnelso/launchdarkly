#!/usr/bin/env bash
# Usage:   npm run setup:part2        (from the repo root)
# Requires in server/.env:
#   LD_API_TOKEN     - Organization settings > Authorization > Create token (Writer role)
#   LD_PROJECT_KEY   - optional; auto-detected when the token sees exactly one project
#   LD_ENV_KEY       - optional; default "test"
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/server/.env"
FLAG_KEY="${LD_FLAG_KEY:-landing-hero-v-2}"
API="https://app.launchdarkly.com/api/v2"

if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

if [[ -z "${LD_API_TOKEN:-}" ]]; then
  echo "LD_API_TOKEN is not set in server/.env (see server/.env.example)." >&2
  exit 1
fi
LD_ENV_KEY="${LD_ENV_KEY:-test}"

api() { # method path [json-body] [extra content-type]
  local method=$1 path=$2 body=${3:-} ctype=${4:-application/json}
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "$API$path" -H "Authorization: $LD_API_TOKEN" -H "Content-Type: $ctype" -d "$body"
  else
    curl -sS -X "$method" "$API$path" -H "Authorization: $LD_API_TOKEN"
  fi
}

if [[ -z "${LD_PROJECT_KEY:-}" ]]; then
  LD_PROJECT_KEY=$(api GET "/projects?limit=20" | python3 -c '
import sys, json
items = json.load(sys.stdin).get("items", [])
if len(items) == 1:
    print(items[0]["key"])
else:
    sys.stderr.write("Set LD_PROJECT_KEY in server/.env; projects visible to this token: " + ", ".join(p["key"] for p in items) + "\n")
    sys.exit(1)')
fi
echo "Project: $LD_PROJECT_KEY   Environment: $LD_ENV_KEY   Flag: $FLAG_KEY"

FLAG_JSON=$(api GET "/flags/$LD_PROJECT_KEY/$FLAG_KEY?env=$LD_ENV_KEY")
read -r TRUE_ID FALSE_ID < <(printf '%s' "$FLAG_JSON" | python3 -c '
import sys, json
f = json.load(sys.stdin)
if "variations" not in f:
    sys.stderr.write("Flag lookup failed: " + json.dumps(f)[:300] + "\n"); sys.exit(1)
ids = {v["value"]: v["_id"] for v in f["variations"]}
print(ids[True], ids[False])')

BODY=$(python3 - "$LD_ENV_KEY" "$TRUE_ID" "$FALSE_ID" <<'PY'
import json, sys
env, true_id, false_id = sys.argv[1:4]
print(json.dumps({
  "environmentKey": env,
  "comment": "Part 2 targeting via scripts/setup-part2-targeting.sh",
  "instructions": [
    {"kind": "addTargets", "contextKind": "user", "variationId": true_id, "values": ["alice-chen"]},
    {"kind": "addRule", "variationId": true_id,
     "clauses": [{"contextKind": "user", "attribute": "betaTester", "op": "in", "values": [True], "negate": False}]},
    {"kind": "addRule", "variationId": true_id,
     "clauses": [{"contextKind": "organization", "attribute": "plan", "op": "in", "values": ["enterprise"], "negate": False}]},
    {"kind": "updateFallthroughVariationOrRollout", "variationId": false_id},
    {"kind": "turnFlagOn"},
  ],
}))
PY
)

echo "Applying targeting ..."
HTTP_STATUS=$(curl -sS -o /tmp/ld-part2-targeting.json -w '%{http_code}' \
  -X PATCH "$API/flags/$LD_PROJECT_KEY/$FLAG_KEY?ignoreConflicts=true" \
  -H "Authorization: $LD_API_TOKEN" \
  -H 'Content-Type: application/json; domain-model=launchdarkly.semanticpatch' \
  -d "$BODY")
echo "HTTP $HTTP_STATUS"
if [[ "$HTTP_STATUS" != "200" ]]; then
  cat /tmp/ld-part2-targeting.json >&2; echo >&2
  exit 1
fi

python3 - "$LD_ENV_KEY" <<'PY' < /tmp/ld-part2-targeting.json
import json, sys
env = sys.argv[1]
f = json.load(sys.stdin)
e = f["environments"][env]
names = {v["_id"]: v["value"] for v in f["variations"]}
print("Flag on:", e["on"])
for t in e.get("contextTargets", []) + e.get("targets", []):
    print(f"  individual target ({t.get('contextKind','user')}): {t['values']} -> {names.get(t.get('variationId'), t.get('variation'))}")
for i, r in enumerate(e.get("rules", []), 1):
    c = r["clauses"][0]
    print(f"  rule {i} '{r.get('description','')}': {c.get('contextKind','user')}.{c['attribute']} {c['op']} {c['values']} -> {names.get(r.get('variationId'))}")
print("  default rule ->", names.get(e["fallthrough"].get("variationId")))
PY
echo "Done. Switch personas in the app's Admin drawer to see each one evaluated."
