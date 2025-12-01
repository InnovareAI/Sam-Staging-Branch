# Google Chat Notifications Setup

SAM's health check agents can send status notifications to a Google Chat space when they complete.

## Setup Steps

### 1. Create a Google Chat Webhook

1. Open **Google Chat** in your browser
2. Navigate to the space where you want notifications
3. Click the space name at the top → **Apps & integrations** → **Webhooks**
4. Click **Create webhook**
5. Enter a name (e.g., "SAM Health Checks")
6. Optionally add an avatar URL
7. Click **Save**
8. **Copy the webhook URL** (it looks like: `https://chat.googleapis.com/v1/spaces/...`)

### 2. Add Environment Variable

Add the webhook URL to your environment:

**Local development** (`.env.local`):
```bash
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/XXXXX/messages?key=XXXXX&token=XXXXX
```

**Netlify production**:
1. Go to Netlify → Site settings → Environment variables
2. Add `GOOGLE_CHAT_WEBHOOK_URL` with the webhook URL value

### 3. Verify Setup

The notifications will be sent automatically when health checks run. To test manually:

```bash
# Trigger daily health check
curl -X POST https://app.meet-sam.com/api/agents/daily-health-check \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

## Notification Types

| Agent | Schedule | Description |
|-------|----------|-------------|
| Daily Health Check | 7 AM UTC | System health, database, queue, accounts |
| QA Monitor | 6 AM UTC | Pipeline consistency, orphaned records |
| Rate Limit Monitor | Every 30 min | LinkedIn account usage limits |
| Data Quality Check | Monday 8 AM UTC | Duplicates, invalid data, stale records |

## Notification Format

Notifications are sent as Google Chat cards with:

- **Header**: Agent name + status emoji (✅/⚠️/🚨)
- **Status**: Healthy, Warning, or Critical
- **Summary**: AI-generated summary of findings
- **Check Results**: Individual check status (up to 10)
- **Recommendations**: Suggested actions (if any)
- **Duration**: How long the check took

### Example Notification

```
✅ SAM Daily Health Check
Status: HEALTHY

Summary: All systems operational. Database responding normally with 45ms latency.
Queue processing active with no stuck items.

Check Results:
✅ Database Connection: Connected. Query latency: 45ms
✅ Campaign Execution (24h): 12 prospects processed. Success: 100%
✅ Message Queue: Queue healthy. 24h: 8 sent, 0 pending, 0 failed
✅ Unipile/LinkedIn Accounts: All 3 accounts healthy
✅ Error Rate (24h): 0 errors in last 24h
✅ Stale Data: 0 stale campaigns, 0 stale prospects

Timestamp: Dec 1, 2025, 7:00 AM PT
Duration: 2.3s
```

## Disabling Notifications

To disable notifications, simply remove or comment out the `GOOGLE_CHAT_WEBHOOK_URL` environment variable. The health checks will continue to run and log to console, but no chat notifications will be sent.

## Troubleshooting

**Notifications not appearing?**
1. Check the webhook URL is correct in environment variables
2. Verify the webhook is still active in Google Chat space settings
3. Check Netlify function logs for errors

**Test the webhook directly:**
```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test notification from SAM"}'
```

---

**Files:**
- [lib/notifications/google-chat.ts](../lib/notifications/google-chat.ts) - Notification helper
- [app/api/agents/daily-health-check/route.ts](../app/api/agents/daily-health-check/route.ts) - Daily health check
- [app/api/agents/qa-monitor/route.ts](../app/api/agents/qa-monitor/route.ts) - QA monitor

**Last Updated:** December 1, 2025
