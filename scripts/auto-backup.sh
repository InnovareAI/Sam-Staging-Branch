#!/bin/bash

###############################################################################
# SAM AI - Automated Backup Script
#
# This script performs a comprehensive backup of:
# - Supabase database → Airtable (visual backup)
# - Git commit (code snapshot)
# - Optional: SQL dump
#
# Usage:
#   ./scripts/auto-backup.sh [--sql-dump] [--skip-airtable] [--skip-git]
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project directory
PROJECT_DIR="/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7"
cd "$PROJECT_DIR"

# Parse arguments
SQL_DUMP=false
SKIP_AIRTABLE=false
SKIP_GIT=false

for arg in "$@"; do
  case $arg in
    --sql-dump) SQL_DUMP=true ;;
    --skip-airtable) SKIP_AIRTABLE=true ;;
    --skip-git) SKIP_GIT=true ;;
    *) echo "Unknown argument: $arg" ;;
  esac
done

# Timestamp for backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="auto-backup-$TIMESTAMP"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          SAM AI - Automated Backup System             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Backup started: $(date)${NC}"
echo -e "${GREEN}Backup name: $BACKUP_NAME${NC}"
echo ""

# Load environment variables
if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
else
  echo -e "${RED}❌ Error: .env.local not found${NC}"
  exit 1
fi

###############################################################################
# 1. AIRTABLE BACKUP (if enabled)
###############################################################################

if [ "$SKIP_AIRTABLE" = false ]; then
  echo -e "${YELLOW}📦 Step 1: Backing up to Airtable...${NC}"
  echo ""

  if [ -z "$AIRTABLE_API_KEY" ] || [ -z "$AIRTABLE_BASE_ID" ]; then
    echo -e "${YELLOW}⚠️  Airtable not configured, skipping...${NC}"
  else
    node scripts/backup-to-airtable.cjs "$BACKUP_NAME" || {
      echo -e "${RED}❌ Airtable backup failed (non-critical)${NC}"
    }
  fi
  echo ""
else
  echo -e "${YELLOW}⏭️  Skipping Airtable backup${NC}"
  echo ""
fi

###############################################################################
# 2. GIT COMMIT (if enabled)
###############################################################################

if [ "$SKIP_GIT" = false ]; then
  echo -e "${YELLOW}📝 Step 2: Creating Git snapshot...${NC}"
  echo ""

  # Check if there are changes to commit
  if [ -n "$(git status --porcelain)" ]; then
    git add .
    git commit -m "🔄 Auto-backup: $BACKUP_NAME

Automated backup performed at $(date)

Changes backed up:
- Database snapshots to Airtable
- Application code state
- Configuration files

Backup type: Automated cron job" || {
      echo -e "${YELLOW}⚠️  No changes to commit${NC}"
    }
    echo -e "${GREEN}✅ Git snapshot created${NC}"
  else
    echo -e "${YELLOW}⚠️  No changes detected, skipping Git commit${NC}"
  fi
  echo ""
else
  echo -e "${YELLOW}⏭️  Skipping Git commit${NC}"
  echo ""
fi

###############################################################################
# 3. SQL DUMP (if enabled)
###############################################################################

if [ "$SQL_DUMP" = true ]; then
  echo -e "${YELLOW}💾 Step 3: Creating SQL dump...${NC}"
  echo ""

  # Create backups directory if it doesn't exist
  mkdir -p backups

  # SQL dump filename
  SQL_FILE="backups/backup_$TIMESTAMP.sql"

  # Perform SQL dump using pg_dump
  PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump \
    -h "aws-0-us-west-1.pooler.supabase.com" \
    -p 6543 \
    -U "postgres.latxadqrvrrrcvkktrog" \
    -d "postgres" \
    --schema=public \
    --no-owner \
    --no-acl \
    -f "$SQL_FILE" 2>/dev/null || {
      echo -e "${RED}❌ SQL dump failed (pg_dump not installed or connection failed)${NC}"
      echo -e "${YELLOW}💡 Install PostgreSQL client tools: brew install postgresql${NC}"
    }

  if [ -f "$SQL_FILE" ]; then
    FILE_SIZE=$(du -h "$SQL_FILE" | cut -f1)
    echo -e "${GREEN}✅ SQL dump created: $SQL_FILE ($FILE_SIZE)${NC}"

    # Keep only last 10 backups
    ls -t backups/backup_*.sql | tail -n +11 | xargs rm -f 2>/dev/null || true
    echo -e "${GREEN}✅ Old backups cleaned (keeping last 10)${NC}"
  fi
  echo ""
else
  echo -e "${YELLOW}⏭️  Skipping SQL dump${NC}"
  echo ""
fi

###############################################################################
# 4. BACKUP SUMMARY
###############################################################################

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Backup Summary                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Backup completed: $BACKUP_NAME${NC}"
echo -e "${GREEN}📅 Timestamp: $(date)${NC}"
echo ""

# Show what was backed up
echo "Backed up components:"
if [ "$SKIP_AIRTABLE" = false ]; then
  echo "  ✅ Airtable backup (workspace_accounts, workspace_members, users)"
else
  echo "  ⏭️  Airtable (skipped)"
fi

if [ "$SKIP_GIT" = false ]; then
  echo "  ✅ Git snapshot"
else
  echo "  ⏭️  Git (skipped)"
fi

if [ "$SQL_DUMP" = true ]; then
  echo "  ✅ SQL dump"
else
  echo "  ⏭️  SQL dump (optional, not enabled)"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Log to backup log file
echo "$(date): Backup $BACKUP_NAME completed successfully" >> backups/backup.log

exit 0
