#!/bin/bash
# Final Migration Verification Script
# Run this after deploying to verify everything works

set -e

echo "=========================================="
echo "     SAM MIGRATION VERIFICATION"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Base URL (change for production)
BASE_URL="${1:-http://localhost:3000}"

echo "Testing against: $BASE_URL"
echo ""

# 1. CODEBASE VERIFICATION
echo "=== 1. CODEBASE CHECKS ==="

echo -n "  Supabase imports: "
COUNT=$(grep -r "from '@supabase" app/ lib/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$COUNT" -eq "0" ]; then
  echo -e "${GREEN}✓ None${NC}"
else
  echo -e "${RED}✗ $COUNT found${NC}"
fi

echo -n "  netlify.toml: "
if [ ! -f "netlify.toml" ]; then
  echo -e "${GREEN}✓ Deleted${NC}"
else
  echo -e "${RED}✗ Still exists${NC}"
fi

echo -n "  Firebase Admin: "
COUNT=$(grep -r "firebase-admin" lib/ --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}✓ $COUNT usages${NC}"

echo -n "  pool.query: "
COUNT=$(grep -r "pool.query" app/ lib/ --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}✓ $COUNT usages${NC}"

echo ""

# 2. BUILD VERIFICATION
echo "=== 2. BUILD CHECK ==="
echo -n "  npm run build: "
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Success${NC}"
else
  echo -e "${RED}✗ Failed${NC}"
  exit 1
fi

echo ""

# 3. API ENDPOINT TESTS
echo "=== 3. API ENDPOINT TESTS ==="

# Health check
echo -n "  GET /api/health: "
RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null || echo "000")
if [ "$RESP" = "200" ]; then
  echo -e "${GREEN}✓ $RESP${NC}"
else
  echo -e "${YELLOW}⚠ $RESP${NC}"
fi

# Session endpoint
echo -n "  GET /api/auth/session: "
RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/session" 2>/dev/null || echo "000")
if [ "$RESP" = "200" ]; then
  echo -e "${GREEN}✓ $RESP${NC}"
else
  echo -e "${YELLOW}⚠ $RESP${NC}"
fi

# Campaigns endpoint (requires auth)
echo -n "  GET /api/campaigns: "
RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/campaigns" 2>/dev/null || echo "000")
if [ "$RESP" = "200" ] || [ "$RESP" = "401" ]; then
  echo -e "${GREEN}✓ $RESP${NC}"
else
  echo -e "${YELLOW}⚠ $RESP${NC}"
fi

echo ""

# 4. DATABASE CONNECTION
echo "=== 4. DATABASE CONNECTION ==="
echo -n "  PostgreSQL: "
if node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('SELECT 1').then(() => { console.log('OK'); process.exit(0); }).catch(e => { console.log('FAIL'); process.exit(1); });
" 2>/dev/null; then
  echo -e "${GREEN}✓ Connected${NC}"
else
  echo -e "${YELLOW}⚠ Check DATABASE_URL${NC}"
fi

echo ""

# 5. CLOUD SCHEDULER JOBS
echo "=== 5. CLOUD SCHEDULER JOBS ==="
echo -n "  Jobs configured: "
COUNT=$(gcloud scheduler jobs list --location=europe-west1 --format="value(name)" 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}$COUNT jobs${NC}"

echo -n "  Paused jobs: "
PAUSED=$(gcloud scheduler jobs list --location=europe-west1 --filter="state=PAUSED" --format="value(name)" 2>/dev/null | wc -l | tr -d ' ')
if [ "$PAUSED" -gt "0" ]; then
  echo -e "${YELLOW}$PAUSED paused${NC}"
else
  echo -e "${GREEN}0 paused${NC}"
fi

echo ""
echo "=========================================="
echo "         VERIFICATION COMPLETE"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. git push origin main"
echo "  2. gcloud run deploy sam-web --source . --region europe-west1"
echo "  3. Resume scheduler jobs if needed"
