#!/bin/bash
#
# Workspace Integrity Monitor - Cron Wrapper
#
# This script runs the workspace integrity check and logs results
# Designed to be run via cron every 12 hours
#

# Set working directory to project root
cd "$(dirname "$0")/.." || exit 1

# Load environment variables
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# Set log directory
LOG_DIR="./logs/workspace-integrity"
mkdir -p "$LOG_DIR"

# Set log file with timestamp
LOG_FILE="$LOG_DIR/check-$(date +%Y%m%d-%H%M%S).log"

# Run the integrity check
echo "Starting workspace integrity check at $(date)" | tee "$LOG_FILE"
echo "─────────────────────────────────────────────────────────────" | tee -a "$LOG_FILE"

npx tsx scripts/monitor-workspace-integrity.ts 2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo "─────────────────────────────────────────────────────────────" | tee -a "$LOG_FILE"
echo "Completed at $(date) with exit code: $EXIT_CODE" | tee -a "$LOG_FILE"

# Keep only last 30 days of logs
find "$LOG_DIR" -name "check-*.log" -mtime +30 -delete

# If there were issues (exit code 1), you could send an email alert here
if [ $EXIT_CODE -ne 0 ]; then
  echo "⚠️  Issues detected. Check log: $LOG_FILE"

  # Optional: Send email alert (uncomment and configure)
  # mail -s "SAM AI: Workspace Integrity Issues Detected" admin@innovareai.com < "$LOG_FILE"
fi

exit $EXIT_CODE
