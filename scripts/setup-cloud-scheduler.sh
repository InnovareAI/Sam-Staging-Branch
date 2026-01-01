#!/bin/bash
# ================================================
# Google Cloud Scheduler Setup for SAM Platform
# Uses EXISTING Cloud Run services
# ================================================

set -e

PROJECT_ID="sam-agentic-system"
REGION="europe-west1"  # Cloud Scheduler location (nearest to Cloud Run europe-west4)
SERVICE_ACCOUNT="cloudscheduler-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
CRON_SECRET="${CRON_SECRET:-}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "================================================"
echo "Google Cloud Scheduler Setup for SAM Platform"
echo "================================================"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Check if CRON_SECRET is set
if [ -z "$CRON_SECRET" ]; then
    echo -e "${RED}ERROR: CRON_SECRET environment variable not set${NC}"
    echo "Usage: CRON_SECRET=your-secret ./scripts/setup-cloud-scheduler.sh"
    exit 1
fi

# Base URL pattern: https://{service-name}-aeqfh5vpba-ey.a.run.app
BASE_SUFFIX="-aeqfh5vpba-ey.a.run.app"

create_job() {
    local name=$1
    local schedule=$2
    local service=$3
    local description=$4
    
    local url="https://${service}${BASE_SUFFIX}"
    
    echo -e "${YELLOW}Creating: $name -> $service${NC}"
    
    # Delete if exists
    gcloud scheduler jobs delete "$name" --location="$REGION" --quiet 2>/dev/null || true
    
    gcloud scheduler jobs create http "$name" \
        --location="$REGION" \
        --schedule="$schedule" \
        --uri="$url" \
        --http-method="POST" \
        --oidc-service-account-email="$SERVICE_ACCOUNT" \
        --headers="x-cron-secret=${CRON_SECRET},Content-Type=application/json" \
        --attempt-deadline="540s" \
        --time-zone="UTC" \
        --description="$description" \
        --quiet
    
    echo -e "${GREEN}✓ $name${NC}"
}

# ================================================
# CORE CAMPAIGN EXECUTION
# ================================================

create_job "sam-execute-campaigns" \
    "*/2 * * * *" \
    "scheduled-campaign-execution" \
    "Execute scheduled campaigns every 2 minutes"

create_job "sam-process-send-queue" \
    "* * * * *" \
    "process-send-queue" \
    "Process send queue every minute"

create_job "sam-process-pending-prospects" \
    "*/5 * * * *" \
    "process-pending-prospects" \
    "Process pending prospects every 5 minutes"

create_job "sam-queue-pending-prospects" \
    "*/5 * * * *" \
    "queue-pending-prospects" \
    "Queue pending prospects every 5 minutes"

create_job "sam-process-email-queue" \
    "*/13 * * * *" \
    "process-email-queue" \
    "Process email queue every 13 minutes"

# ================================================
# REPLY DETECTION
# ================================================

create_job "sam-poll-accepted-connections" \
    "*/15 * * * *" \
    "poll-accepted-connections" \
    "Poll for accepted connections every 15 minutes"

create_job "sam-poll-message-replies" \
    "*/5 * * * *" \
    "poll-message-replies" \
    "Poll for message replies every 5 minutes"

create_job "sam-poll-email-replies" \
    "*/5 * * * *" \
    "poll-email-replies" \
    "Poll for email replies every 5 minutes"

create_job "sam-reply-agent-process" \
    "*/5 * * * *" \
    "reply-agent-process" \
    "Reply Agent processing every 5 minutes"

# ================================================
# FOLLOW-UPS
# ================================================

create_job "sam-send-follow-ups" \
    "*/30 * * * *" \
    "send-follow-ups" \
    "Send follow-ups every 30 minutes"

create_job "sam-generate-follow-up-drafts" \
    "15 * * * *" \
    "generate-follow-up-drafts" \
    "Generate follow-up drafts every hour"

create_job "sam-send-approved-follow-ups" \
    "*/15 * * * *" \
    "send-approved-follow-ups" \
    "Send approved follow-ups every 15 minutes"

# ================================================
# COMMENTING AGENT
# ================================================

create_job "sam-discover-posts" \
    "0 */6 * * *" \
    "discover-posts" \
    "Discover posts every 6 hours"

create_job "sam-auto-generate-comments" \
    "*/30 * * * *" \
    "auto-generate-comments" \
    "Auto-generate comments every 30 minutes"

create_job "sam-process-comment-queue" \
    "*/45 * * * *" \
    "process-comment-queue" \
    "Process comment queue every 45 minutes"

create_job "sam-track-comment-performance" \
    "0 */6 * * *" \
    "track-comment-performance" \
    "Track comment performance every 6 hours"

create_job "sam-commenting-digest" \
    "0 13 * * 1-5" \
    "commenting-digest" \
    "Commenting digest Mon-Fri 1 PM UTC"

create_job "sam-expire-comment-content" \
    "0 6 * * 1-5" \
    "expire-comment-content" \
    "Expire comment content Mon-Fri 6 AM UTC"

create_job "sam-daily-repost" \
    "0 18 * * *" \
    "daily-repost" \
    "Daily repost at 6 PM UTC"

# ================================================
# SELF-POST ENGAGEMENT
# ================================================

create_job "sam-discover-self-post-comments" \
    "*/30 * * * *" \
    "discover-self-post-comments" \
    "Discover self-post comments every 30 minutes"

create_job "sam-process-self-post-replies" \
    "*/30 * * * *" \
    "process-self-post-replies" \
    "Process self-post replies every 30 minutes"

# ================================================
# MEETING AGENT
# ================================================

create_job "sam-calendar-agent" \
    "*/15 * * * *" \
    "calendar-agent" \
    "Calendar agent every 15 minutes"

create_job "sam-check-meeting-status" \
    "*/15 * * * *" \
    "check-meeting-status" \
    "Check meeting status every 15 minutes"

create_job "sam-send-meeting-reminders" \
    "*/5 * * * *" \
    "send-meeting-reminders" \
    "Send meeting reminders every 5 minutes"

create_job "sam-send-meeting-follow-ups" \
    "*/15 * * * *" \
    "send-meeting-follow-ups" \
    "Send meeting follow-ups every 15 minutes"

# ================================================
# CRM SYNC
# ================================================

create_job "sam-sync-crm-bidirectional" \
    "*/15 * * * *" \
    "sync-crm-bidirectional" \
    "CRM bi-directional sync every 15 minutes"

# ================================================
# MAINTENANCE & HEALTH
# ================================================

create_job "sam-daily-health-check" \
    "0 7 * * *" \
    "daily-health-check" \
    "Daily health check at 7 AM UTC"

create_job "sam-daily-sync-verification" \
    "0 5 * * *" \
    "daily-sync-verification" \
    "Daily sync verification at 5 AM UTC"

create_job "sam-qa-monitor" \
    "0 5-18 * * 1-5" \
    "qa-monitor" \
    "QA monitor hourly on weekdays"

create_job "sam-qa-monitor-weekend" \
    "0 5 * * 0,6" \
    "qa-monitor-weekend" \
    "QA monitor daily on weekends"

create_job "sam-data-quality-check" \
    "0 8 * * 1" \
    "data-quality-check" \
    "Data quality check Mondays 8 AM UTC"

create_job "sam-rate-limit-monitor" \
    "*/30 * * * *" \
    "rate-limit-monitor" \
    "Rate limit monitor every 30 minutes"

create_job "sam-realtime-error-monitor" \
    "*/5 * * * *" \
    "realtime-error-monitor" \
    "Realtime error monitor every 5 minutes"

create_job "sam-recover-orphan-prospects" \
    "0 * * * *" \
    "recover-orphan-prospects" \
    "Recover orphan prospects every hour"

create_job "sam-withdraw-stale-invitations" \
    "0 8 * * *" \
    "withdraw-stale-invitations" \
    "Withdraw stale invitations at 8 AM UTC"

# ================================================
# DIGESTS
# ================================================

create_job "sam-daily-campaign-summary" \
    "0 16 * * *" \
    "daily-campaign-summary" \
    "Daily campaign summary at 4 PM UTC"

create_job "sam-opportunity-digest" \
    "0 15 * * 1-5" \
    "opportunity-digest" \
    "Opportunity digest Mon-Fri 3 PM UTC"

# ================================================
# LEAD PROCESSING
# ================================================

create_job "sam-process-lead-capture-queue" \
    "*/10 * * * *" \
    "process-lead-capture-queue" \
    "Process lead capture queue every 10 minutes"

echo ""
echo "================================================"
echo -e "${GREEN}✓ All Cloud Scheduler jobs created!${NC}"
echo "================================================"
echo ""
echo "Created $(gcloud scheduler jobs list --location=$REGION --format='value(name)' | wc -l | tr -d ' ') jobs"
echo ""
echo "To view: gcloud scheduler jobs list --location=$REGION"
echo "To run manually: gcloud scheduler jobs run JOB_NAME --location=$REGION"
