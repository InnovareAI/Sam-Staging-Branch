#!/bin/bash

# Deploy to All Tenants Script
# Automatically deploys the current build to main production and all tenant environments

set -e

echo "🚀 Starting multi-tenant deployment process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Build the application first
echo -e "${BLUE}📦 Building application for production...${NC}"
NEXT_PUBLIC_SUPABASE_URL="https://latxadqrvrrrcvkktrog.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ" \
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build completed successfully${NC}"
else
    echo -e "${RED}❌ Build failed. Aborting deployment.${NC}"
    exit 1
fi

# Deploy to main production site (serves all tenants via multi-tenancy)
echo -e "${BLUE}🌐 Deploying to main production (app.meet-sam.com)...${NC}"
netlify deploy --prod --dir=.next --site=sam-new-sep-7

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Main production deployment successful${NC}"
else
    echo -e "${RED}❌ Main production deployment failed${NC}"
    exit 1
fi

# Log deployment success
echo -e "${GREEN}🎉 Multi-tenant deployment completed successfully!${NC}"
echo -e "${YELLOW}📍 All tenants are now running the latest version via:${NC}"
echo -e "   • Main Production: https://app.meet-sam.com"
echo -e "   • Multi-tenant architecture serves all workspaces"
echo -e "${BLUE}💡 Note: Since this is a multi-tenant application, the single production deployment serves all tenant workspaces.${NC}"

# Optional: Health check
echo -e "${BLUE}🔍 Performing health check...${NC}"
curl -s -o /dev/null -w "%{http_code}" https://app.meet-sam.com/api/monitoring/health || echo "Health check endpoint not responding"

echo -e "${GREEN}🚀 Deployment process complete!${NC}"