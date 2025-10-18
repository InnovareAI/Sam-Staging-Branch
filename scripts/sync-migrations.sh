#!/bin/bash

# Sync Migration Script
# This properly syncs local migrations with production state

set -e

echo "🔄 Syncing migrations with production..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Backup existing migrations
echo -e "${BLUE}📦 Step 1: Backing up current migrations...${NC}"
BACKUP_DIR="supabase/migrations.backup.$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r supabase/migrations/* "$BACKUP_DIR/" 2>/dev/null || true
echo -e "${GREEN}✅ Backed up to: $BACKUP_DIR${NC}"

# Step 2: Clear migrations folder
echo -e "${BLUE}🧹 Step 2: Clearing migrations folder...${NC}"
rm -rf supabase/migrations/*
echo -e "${GREEN}✅ Migrations folder cleared${NC}"

# Step 3: Get fresh baseline from production
echo -e "${BLUE}📥 Step 3: Pulling production schema...${NC}"
echo -e "${YELLOW}⚠️  This requires Docker Desktop to be running${NC}"
echo -e "${YELLOW}⚠️  If this fails, we'll use alternative method${NC}"

if supabase db pull --schema public 2>&1; then
    echo -e "${GREEN}✅ Successfully pulled production schema${NC}"
else
    echo -e "${YELLOW}⚠️  Pull failed (likely Docker not running)${NC}"
    echo -e "${BLUE}📝 Creating empty migrations folder for manual baseline...${NC}"
    
    # Restore just the SuperAdmin migration for now
    cp "$BACKUP_DIR/20251018_create_superadmin_analytics.sql" supabase/migrations/ 2>/dev/null || true
    
    echo -e "${YELLOW}⚠️  Manual step required:${NC}"
    echo ""
    echo "Please do ONE of the following:"
    echo ""
    echo "Option A (Recommended): Use Supabase Dashboard"
    echo "  1. Open: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new"
    echo "  2. Copy contents of: supabase/migrations/20251018_create_superadmin_analytics.sql"
    echo "  3. Paste and click 'Run'"
    echo ""
    echo "Option B: Start Docker Desktop then re-run this script"
    echo "  1. Open Docker Desktop"
    echo "  2. Wait for it to start"
    echo "  3. Run: ./scripts/sync-migrations.sh"
    echo ""
    exit 1
fi

# Step 4: Add SuperAdmin migration
echo -e "${BLUE}➕ Step 4: Adding SuperAdmin migration...${NC}"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
cp "$BACKUP_DIR/20251018_create_superadmin_analytics.sql" "supabase/migrations/${TIMESTAMP}_create_superadmin_analytics.sql"
echo -e "${GREEN}✅ Added SuperAdmin migration${NC}"

# Step 5: Push new migrations to production
echo -e "${BLUE}🚀 Step 5: Pushing SuperAdmin migration to production...${NC}"
if supabase db push; then
    echo -e "${GREEN}✅ Successfully pushed migrations to production${NC}"
else
    echo -e "${YELLOW}⚠️  Push failed - you may need to apply manually${NC}"
    exit 1
fi

# Step 6: Verify
echo -e "${BLUE}✅ Step 6: Verifying...${NC}"
supabase migration list

echo ""
echo -e "${GREEN}✨ Migration sync complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Test your dashboard: https://app.meet-sam.com/admin/superadmin"
echo "  2. Commit the synced migrations: git add supabase/migrations && git commit -m 'chore: sync migrations with production'"
echo "  3. Old migrations backed up at: $BACKUP_DIR"
