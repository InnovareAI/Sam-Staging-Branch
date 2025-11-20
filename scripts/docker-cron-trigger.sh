#!/bin/bash
# Docker Cron: Trigger campaign execution via API
# Runs every 2 minutes

API_URL="https://app.meet-sam.com/api/cron/execute-scheduled-campaigns"
CRON_SECRET="${CRON_SECRET:-}"

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "x-docker-cron: true" \
  --max-time 30 \
  --silent \
  --show-error \
  >> /var/log/sam-cron.log 2>&1

echo "[$(date)] Cron executed" >> /var/log/sam-cron.log
