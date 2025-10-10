#!/bin/bash

###############################################################################
# Setup Automated Backup Cron Job
#
# This script configures macOS cron to run automated backups
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Setup Automated Backup Cron Job                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Project directory
PROJECT_DIR="/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7"

# Backup script path
BACKUP_SCRIPT="$PROJECT_DIR/scripts/auto-backup.sh"

# Log file
LOG_FILE="$PROJECT_DIR/backups/cron.log"

# Create backups directory
mkdir -p "$PROJECT_DIR/backups"

echo "Select backup frequency:"
echo ""
echo "1) Daily at 2:00 AM (recommended for production)"
echo "2) Every 6 hours (high-frequency for critical data)"
echo "3) Daily at 2:00 AM + Git commit only (lightweight)"
echo "4) Weekly on Sunday at 2:00 AM (minimal)"
echo "5) Custom schedule"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
  1)
    CRON_SCHEDULE="0 2 * * *"
    CRON_DESCRIPTION="Daily at 2:00 AM"
    CRON_COMMAND="$BACKUP_SCRIPT >> $LOG_FILE 2>&1"
    ;;
  2)
    CRON_SCHEDULE="0 */6 * * *"
    CRON_DESCRIPTION="Every 6 hours"
    CRON_COMMAND="$BACKUP_SCRIPT >> $LOG_FILE 2>&1"
    ;;
  3)
    CRON_SCHEDULE="0 2 * * *"
    CRON_DESCRIPTION="Daily at 2:00 AM (Git only)"
    CRON_COMMAND="$BACKUP_SCRIPT --skip-airtable >> $LOG_FILE 2>&1"
    ;;
  4)
    CRON_SCHEDULE="0 2 * * 0"
    CRON_DESCRIPTION="Weekly on Sunday at 2:00 AM"
    CRON_COMMAND="$BACKUP_SCRIPT >> $LOG_FILE 2>&1"
    ;;
  5)
    echo ""
    echo "Enter cron schedule (e.g., '0 2 * * *' for daily at 2am):"
    read -p "Schedule: " CRON_SCHEDULE
    read -p "Description: " CRON_DESCRIPTION
    CRON_COMMAND="$BACKUP_SCRIPT >> $LOG_FILE 2>&1"
    ;;
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}Setting up cron job...${NC}"
echo ""
echo "  📅 Schedule: $CRON_DESCRIPTION"
echo "  ⏰ Cron: $CRON_SCHEDULE"
echo "  📝 Command: $CRON_COMMAND"
echo "  📋 Log: $LOG_FILE"
echo ""

# Get current crontab
TEMP_CRON=$(mktemp)
crontab -l > "$TEMP_CRON" 2>/dev/null || true

# Remove any existing SAM backup cron jobs
sed -i.bak '/# SAM AI Auto Backup/d' "$TEMP_CRON" 2>/dev/null || true
sed -i.bak '/auto-backup.sh/d' "$TEMP_CRON" 2>/dev/null || true

# Add new cron job
echo "" >> "$TEMP_CRON"
echo "# SAM AI Auto Backup - $CRON_DESCRIPTION" >> "$TEMP_CRON"
echo "$CRON_SCHEDULE $CRON_COMMAND" >> "$TEMP_CRON"

# Install new crontab
crontab "$TEMP_CRON"

# Cleanup
rm "$TEMP_CRON" "$TEMP_CRON.bak" 2>/dev/null || true

echo -e "${GREEN}✅ Cron job installed successfully!${NC}"
echo ""

# Show current crontab
echo -e "${BLUE}Current backup cron jobs:${NC}"
crontab -l | grep -A1 "SAM AI Auto Backup" || echo "None"
echo ""

# Test the backup script
read -p "Would you like to run a test backup now? [y/N]: " test_choice
if [[ "$test_choice" =~ ^[Yy]$ ]]; then
  echo ""
  echo -e "${YELLOW}Running test backup...${NC}"
  echo ""
  $BACKUP_SCRIPT
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Setup Complete!                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next automatic backup: $(date -v +1d '+%Y-%m-%d 02:00:00' 2>/dev/null || echo 'Check cron schedule')"
echo ""
echo "📋 View backup logs:"
echo "   tail -f $LOG_FILE"
echo ""
echo "🔧 Manage cron jobs:"
echo "   crontab -l    # List cron jobs"
echo "   crontab -e    # Edit cron jobs"
echo "   crontab -r    # Remove all cron jobs"
echo ""
echo "🗑️  To remove this backup job:"
echo "   crontab -l | grep -v 'SAM AI Auto Backup' | grep -v 'auto-backup.sh' | crontab -"
echo ""
