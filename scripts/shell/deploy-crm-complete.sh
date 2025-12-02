#!/bin/bash

# Complete CRM Deployment Script
# Runs migrations, deploys N8N workflows, commits to git

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 CRM Integration Complete Deployment${NC}\n"

# ============================================
# 1. Run Database Migrations
# ============================================

echo -e "${GREEN}📊 Step 1: Running Database Migrations${NC}"

if [ -z "$SUPABASE_DATABASE_URL" ]; then
  echo -e "${YELLOW}⚠️  SUPABASE_DATABASE_URL not set, skipping migrations${NC}"
  echo -e "   Set it with: export SUPABASE_DATABASE_URL=postgresql://..."
else
  echo "   Running migration 1..."
  psql "$SUPABASE_DATABASE_URL" -f supabase/migrations/20251005000004_create_crm_integration_tables.sql -q

  echo "   Running migration 2..."
  psql "$SUPABASE_DATABASE_URL" -f supabase/migrations/20251202000000_add_crm_mapping_tables.sql -q

  echo -e "${GREEN}   ✅ Migrations complete${NC}"
fi

# ============================================
# 2. Deploy N8N Workflows
# ============================================

echo -e "\n${GREEN}📤 Step 2: Deploying N8N Workflows${NC}"

if [ -z "$N8N_API_URL" ] || [ -z "$N8N_API_KEY" ]; then
  echo -e "${YELLOW}⚠️  N8N credentials not set, skipping workflow deployment${NC}"
  echo -e "   Set with: export N8N_API_URL=https://n8n.innovareai.com"
  echo -e "            export N8N_API_KEY=your_key"
else
  ./scripts/shell/deploy-n8n-workflows.sh
fi

# ============================================
# 3. Commit and Push to Git
# ============================================

echo -e "\n${GREEN}📝 Step 3: Committing to Git${NC}"

git add .
git commit -m "Add CRM bi-directional sync (Netlify + N8N)" || echo "Nothing to commit"

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ CRM Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}Final Steps:${NC}"
echo -e "1. Set N8N environment variables in N8N UI (Settings → Variables):"
echo -e "   - SUPABASE_URL"
echo -e "   - SUPABASE_SERVICE_ROLE_KEY"
echo -e "   - SAM_API_URL"
echo -e "   - N8N_WEBHOOK_SECRET"
echo -e "\n2. Push to Netlify:"
echo -e "   git push"
echo -e "\n3. Monitor first sync in 15 minutes (Netlify function logs)"

echo -e "\n${GREEN}🎉 Done!${NC}"
