#!/bin/bash

# SAM AI Memory Archival Cron Job Setup
# This script sets up automatic memory archival to run daily

echo "Setting up SAM AI Memory Archival Cron Job..."

# Configuration
SITE_URL="${SITE_URL:-http://localhost:3000}"
API_KEY="${MEMORY_ARCHIVAL_API_KEY:-your-secret-api-key}"
LOG_FILE="/var/log/sam-memory-archival.log"

# Create log file if it doesn't exist
sudo touch "$LOG_FILE"
sudo chmod 666 "$LOG_FILE"

# Create the cron job script
CRON_SCRIPT="/usr/local/bin/sam-memory-archival.sh"

sudo tee "$CRON_SCRIPT" > /dev/null << EOF
#!/bin/bash

# SAM AI Memory Archival Cron Job
# Runs automatic memory archival

TIMESTAMP=\$(date '+%Y-%m-%d %H:%M:%S')
echo "[\$TIMESTAMP] Starting SAM AI memory archival..." >> "$LOG_FILE"

# Call the auto-archive API endpoint
RESPONSE=\$(curl -s -X POST \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  "$SITE_URL/api/sam/memory/auto-archive" \\
  -w "HTTP_STATUS:%{http_code}")

HTTP_STATUS=\$(echo \$RESPONSE | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=\$(echo \$RESPONSE | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "\$HTTP_STATUS" = "200" ]; then
    echo "[\$TIMESTAMP] SUCCESS: \$RESPONSE_BODY" >> "$LOG_FILE"
else
    echo "[\$TIMESTAMP] ERROR (HTTP \$HTTP_STATUS): \$RESPONSE_BODY" >> "$LOG_FILE"
fi

echo "[\$TIMESTAMP] Memory archival job completed" >> "$LOG_FILE"
EOF

# Make the script executable
sudo chmod +x "$CRON_SCRIPT"

# Add cron job to run daily at 2 AM
CRON_JOB="0 2 * * * $CRON_SCRIPT"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "sam-memory-archival"; then
    echo "Cron job already exists. Updating..."
    # Remove existing cron job
    crontab -l 2>/dev/null | grep -v "sam-memory-archival" | crontab -
fi

# Add the new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ SAM AI Memory Archival cron job has been set up!"
echo ""
echo "Configuration:"
echo "  - Runs daily at 2:00 AM"
echo "  - API Endpoint: $SITE_URL/api/sam/memory/auto-archive"
echo "  - Log File: $LOG_FILE"
echo "  - Cron Script: $CRON_SCRIPT"
echo ""
echo "Environment Variables Required:"
echo "  - MEMORY_ARCHIVAL_API_KEY=$API_KEY"
echo "  - SITE_URL=$SITE_URL"
echo ""
echo "To check cron jobs: crontab -l"
echo "To view logs: tail -f $LOG_FILE"
echo "To test manually: $CRON_SCRIPT"
echo ""
echo "⚠️  Make sure to set the MEMORY_ARCHIVAL_API_KEY environment variable in your production environment!"