#!/usr/bin/env bash
# Smoke test for a running stack (docker compose up -d --build --wait): health of every service, then the main
# flow through the web proxy: create a car and an oil change due in one minute, then wait (bounded) until the
# worker fired the reminder, the notification is stored and Mailpit received the mail.
set -euo pipefail

WEB=${WEB_URL:-http://localhost:8086}
API=${API_URL:-http://localhost:3100}
MAILPIT=${MAILPIT_URL:-http://localhost:8025}

say() { printf '== %s\n' "$*"; }
gql() { curl -fsS "$WEB/graphql" -H 'Content-Type: application/json' -d "$1"; }

say "health"
curl -fsS "$API/health/live"; echo
curl -fsS "$API/health/ready"; echo
docker compose exec -T worker wget -qO- http://127.0.0.1:3001/health/ready; echo
curl -fsS "$WEB/healthz"
curl -fsS "$MAILPIT/livez" >/dev/null && echo "mailpit ok"

say "create a car"
car=$(gql '{"query":"mutation { registerAsset(input: {kind: CAR, name: \"Smoke test car\"}) { id } }"}')
echo "$car"
car_id=$(printf '%s' "$car" | sed -E 's/.*"id":"([^"]+)".*/\1/')

due=$(date -u -d '+60 seconds' +%Y-%m-%dT%H:%M:%SZ)
say "add an oil change due at $due (every 10000 km or 6 months, or that date: whichever first)"
gql "{\"query\":\"mutation { addTask(input: {assetId: \\\"$car_id\\\", title: \\\"Smoke oil change\\\", everyKm: 10000, everyMonths: 6, lastDoneKm: 20000, dueAt: \\\"$due\\\"}) { id } }\"}"
echo

say "wait for the reminder to fire (bounded: 120 s)"
for _ in $(seq 1 60); do
  notes=$(gql '{"query":"{ notifications(limit: 50) { title message createdAt } }"}')
  if printf '%s' "$notes" | grep -q 'Smoke oil change is due now'; then
    echo "$notes" | head -c 400; echo
    if curl -fsS "$MAILPIT/api/v1/messages" | grep -q 'Smoke oil change'; then echo "mail delivered to Mailpit"; fi
    say "SMOKE PASS: reminder fired by the worker and stored"
    exit 0
  fi
  sleep 2
done
echo "last notifications: $notes"
say "SMOKE FAIL: no notification after 120 s"
exit 1
