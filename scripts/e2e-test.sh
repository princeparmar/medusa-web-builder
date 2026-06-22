#!/usr/bin/env bash
# End-to-end API flow test for Medusa Web Builder
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR="$(mktemp)"
TEST_EMAIL="e2e-$(date +%s)@test.local"
TEST_PASSWORD="TestPass123!"
TEST_NAME="E2E Tester"

cleanup() { rm -f "$COOKIE_JAR"; }
trap cleanup EXIT

step() { echo ""; echo "==> $1"; }
fail() { echo "FAIL: $1"; exit 1; }

step "1. Register user ($TEST_EMAIL)"
REGISTER_RES=$(curl -sS -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"$TEST_NAME\"}")
HTTP_CODE=$(echo "$REGISTER_RES" | tail -1)
BODY=$(echo "$REGISTER_RES" | sed '$d')
[[ "$HTTP_CODE" == "201" ]] || fail "Register returned $HTTP_CODE: $BODY"
echo "$BODY"

step "2. Verify email via token"
sleep 1
TOKEN=$(docker compose -f "$ROOT/docker/docker-compose.yml" exec -T postgres \
  psql -U mwb -d medusa_web_builder -tAc \
  "SELECT token FROM \"VerificationToken\" WHERE identifier='$TEST_EMAIL' LIMIT 1;" | tr -d '[:space:]')
[[ -n "$TOKEN" ]] || fail "No verification token found"
VERIFY_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -L "$BASE_URL/api/auth/verify-email?token=$TOKEN")
[[ "$VERIFY_CODE" =~ ^(200|302)$ ]] || fail "Email verification failed: $VERIFY_CODE"

step "3. Sign in"
CSRF=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/auth/csrf" | python3 -c "import json,sys; print(json.load(sys.stdin)['csrfToken'])")
curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=$TEST_EMAIL" \
  --data-urlencode "password=$TEST_PASSWORD" \
  --data-urlencode "callbackUrl=$BASE_URL/dashboard" \
  -o /dev/null -w "" -L

SESSION_CHECK=$(curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/auth/session")
echo "Session: $SESSION_CHECK"
echo "$SESSION_CHECK" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if d.get('user') else 1)" || fail "No session after sign in"

step "4. Complete profile"
PROFILE_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" \
  -X PUT "$BASE_URL/api/user/profile" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$TEST_NAME\",\"companyName\":\"E2E Co\",\"defaultRegion\":\"in\"}")
[[ "$PROFILE_CODE" == "200" ]] || fail "Profile update failed: $PROFILE_CODE"

step "5. Create project (triggers scaffold worker)"
PROJECT_RES=$(curl -sS -w "\n%{http_code}" -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/projects" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E Shop","preset":"minimal"}')
HTTP_CODE=$(echo "$PROJECT_RES" | tail -1)
BODY=$(echo "$PROJECT_RES" | sed '$d')
[[ "$HTTP_CODE" == "201" ]] || fail "Create project failed: $HTTP_CODE $BODY"
PROJECT_ID=$(echo "$BODY" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "Project ID: $PROJECT_ID"

step "6. Poll until project is READY (max 5 min)"
STATUS=""
for i in $(seq 1 60); do
  PROJ=$(curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/projects/$PROJECT_ID")
  STATUS=$(echo "$PROJ" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status',''))")
  echo "  attempt $i: status=$STATUS"
  if [[ "$STATUS" == "READY" ]]; then break; fi
  if [[ "$STATUS" == "ERROR" ]]; then
    ERR=$(echo "$PROJ" | python3 -c "import json,sys; print(json.load(sys.stdin).get('errorMessage',''))")
    fail "Scaffold failed: $ERR"
  fi
  sleep 5
done
[[ "$STATUS" == "READY" ]] || fail "Project did not become READY in time"

step "7. List registry sections"
SECTIONS=$(curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/registry/sections?pageType=/")
SECTION_COUNT=$(echo "$SECTIONS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
echo "Sections: $SECTION_COUNT"
[[ "$SECTION_COUNT" -gt 0 ]] || fail "No sections in registry"

step "8. Read and update pages config"
PAGES=$(curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/projects/$PROJECT_ID/pages")
PAGE_COUNT=$(echo "$PAGES" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('pages',[])))")
echo "Pages: $PAGE_COUNT"
[[ "$PAGE_COUNT" -gt 0 ]] || fail "No pages in project"

UPDATE_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" \
  -X PUT "$BASE_URL/api/projects/$PROJECT_ID/pages" \
  -H "Content-Type: application/json" \
  -d "$(echo "$PAGES" | python3 -c "
import json,sys
d=json.load(sys.stdin)
d['brand']={'companyName':'E2E Co'}
print(json.dumps(d))
")")
[[ "$UPDATE_CODE" == "200" ]] || fail "Pages update failed: $UPDATE_CODE"

step "9. Save draft (git commit job)"
DRAFTS=$(curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/projects/$PROJECT_ID/drafts")
DRAFT_ID=$(echo "$DRAFTS" | python3 -c "import json,sys; ds=json.load(sys.stdin); print(next((d['id'] for d in ds if d.get('isActive')), ds[0]['id'] if ds else ''))")
[[ -n "$DRAFT_ID" ]] || fail "No draft found"
SAVE_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/projects/$PROJECT_ID/drafts/$DRAFT_ID/save" \
  -H "Content-Type: application/json" \
  -d '{"message":"chore: e2e test save"}')
[[ "$SAVE_CODE" == "200" ]] || fail "Draft save failed: $SAVE_CODE"
sleep 3

step "10. Registry plugins + team invites"
PLUGINS_COUNT=$(curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/registry/plugins" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('total', len(d)) if isinstance(d,dict) else len(d))")
echo "Plugins: $PLUGINS_COUNT"
TEAM_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE_URL/api/projects/$PROJECT_ID/invites")
[[ "$TEAM_CODE" == "200" ]] || fail "Invites list failed: $TEAM_CODE"

echo ""
echo "E2E flow passed"
echo "  User: $TEST_EMAIL"
echo "  Project: $PROJECT_ID"
