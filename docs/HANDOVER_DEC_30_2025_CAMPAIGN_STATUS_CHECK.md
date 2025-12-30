# Handover Document: Sam AI Platform - Dec 30, 2025

## 1. Executive Summary

**Current Status:** Production (app.meet-sam.com) is live. LinkedIn campaign queue processor is running.

**Major Accomplishments:**
- Created campaign monitoring scripts for quick status checks
- Resumed paused campaigns for 6 LinkedIn accounts
- Verified Sebastian Henkel's campaign is actively sending (3/25 today)
- Discussed future migration from Supabase/Netlify to Firebase/Google Cloud

## 2. Campaign Status Check Scripts

### Scripts Created

| Script | Purpose | Location |
|--------|---------|----------|
| `check-campaigns.mjs` | Overall campaign status, stuck items, Sebastian check | `scripts/js/check-campaigns.mjs` |
| `queue-sebastian.mjs` | Queue approved prospects for Sebastian | `scripts/js/queue-sebastian.mjs` |
| `check-all-accounts.mjs` | List all LinkedIn accounts with active campaigns | `scripts/js/check-all-accounts.mjs` |
| `queue-by-account.mjs` | Send queue stats grouped by LinkedIn account | `scripts/js/queue-by-account.mjs` |
| `resume-campaigns.mjs` | Resume paused campaigns for specified accounts | `scripts/js/resume-campaigns.mjs` |

### Running the Scripts

```bash
# Set the production Supabase service role key
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ" node scripts/js/check-campaigns.mjs

# Check queue stats by account
SUPABASE_SERVICE_ROLE_KEY="..." node scripts/js/queue-by-account.mjs

# Resume campaigns for specific accounts
SUPABASE_SERVICE_ROLE_KEY="..." node scripts/js/resume-campaigns.mjs
```

## 3. LinkedIn Account Status (Dec 30, 2025)

### Send Queue by Account

| Account | Pending | Sent | Failed | Today's Sends |
|---------|---------|------|--------|---------------|
| Charissa Saniel | 65 | 149 | 4 | 0/25 |
| Brian Neirby | 37 | 2 | 1 | 0/25 |
| Rony Chatterjee | 26 | 1 | 8 | 0/25 |
| Samantha Truman | 14 | 101 | 28 | 0/25 |
| jf@innovareai.com | 7 | 0 | 0 | 0/25 |
| Thorsten Linz | 6 | 43 | 5 | 0/25 |
| Michelle Gestuveo | 1 | 113 | 5 | 0/25 |
| Irish Maguad | 0 | 161 | 1 | 0/25 |
| **Sebastian Henkel** | **0** | **145** | **2** | **3/25** ✅ |
| Stan Bounev | 0 | 38 | 0 | 0/25 |

**Totals:** 156 pending | 753 sent | 55 failed | 3 sent today (all Sebastian)

### Active Campaigns by Account

**8 LinkedIn Accounts with 23 Active Campaigns:**

1. **Irish Maguad** - 5 campaigns (IA- Canada- Startup 1-5)
2. **Charissa Saniel** - 7 campaigns (IA- Canada- Startup 1-7)
3. **Thorsten Linz** - 2 campaigns (IA- Techstars- Founders, IA/ Techstars/ 1st Degree)
4. **Michelle Gestuveo** - 4 campaigns (IA- Canada- Startup 1-4)
5. **Stan Bounev** - 1 campaign (20251210-41-USA CISO's)
6. **Sebastian Henkel** - 2 campaigns (Sebastian Henkel - Connect, ASP - Company Follow)
7. **Rony Chatterjee** - 1 campaign (Tursio.ai Credit Union Outreach)
8. **Brian Neirby** - 1 campaign (Chillmine - Connect)

### Campaigns Resumed

Resumed 2 paused campaigns for Samantha Truman:
- ✅ Consulting- Sequence A
- ✅ Consulting- Sequence B

## 4. Key Technical Details

### Rate Limits

From `lib/anti-detection/message-variance.ts`:

```typescript
export const MESSAGE_HARD_LIMITS = {
  MAX_CONNECTION_REQUESTS_PER_DAY: 25,
  MAX_MESSAGES_PER_DAY: 50,
  MAX_CONNECTION_REQUESTS_PER_WEEK: 100,
  MAX_CONNECTION_REQUESTS_PER_HOUR: 5,
  MIN_CR_GAP_MINUTES: 20,
};
```

### Queue Processor

- **Cron:** Every minute via Netlify scheduled function
- **Endpoint:** `/api/cron/process-send-queue`
- **CRON_SECRET:** `sam-cron-prod-c1ecde772534a1017b45d7023e141488`
- **Business Hours:** Respects campaign timezone and country_code

### Campaign Table Key Columns

- `linkedin_account_id` - Links to `user_unipile_accounts.id`
- `timezone` - e.g., "Europe/Berlin", "America/Los_Angeles"
- `country_code` - e.g., "DE", "US" (for holiday calendar)
- `status` - "active", "paused", "draft", "archived"

### send_queue Table Key Columns

- `campaign_id` - Links to campaigns
- `prospect_id` - Links to campaign_prospects
- `status` - "pending", "sent", "failed"
- `scheduled_for` - When to send
- `sent_at` - When actually sent

## 5. Future Migration Discussion

User is planning to migrate from Supabase/Netlify to Firebase/Google Cloud:

### Motivation
- Netlify function limitations (no parallel execution, 26s timeout)
- Scalability needs

### Recommendation
- **Cloud SQL (PostgreSQL)** over Firestore for Sam's 150+ relational tables
- Keep Claude SDK (just API calls, works anywhere)
- Use Cloud Run + Pub/Sub for parallel processing

### Migration Scope (from earlier analysis)
- 583 files importing Supabase
- 150+ database tables
- 625 RLS policies
- 1,113 API routes
- 39 Netlify scheduled functions
- Estimated effort: 20-30 weeks

## 6. Important Notes

### Charissa Saniel Account
- Name uses Unicode bold characters: `𝗖𝗵𝗮𝗿𝗶𝘀𝘀𝗮 𝗦𝗮𝗻𝗶𝗲𝗹`
- ID: `c53d51a2-0727-4ad0-b746-ed7889d8eb97`
- ilike searches for "charissa" won't match - use account ID directly

### Sebastian Henkel Campaign
- Timezone: Europe/Berlin
- Country: DE
- Is actively processing (3 sends today)
- Queue items processed during Berlin business hours

### Queue Processor Observations
- Only Sebastian's queue is actively processing today
- Other accounts have pending items but 0 sends today
- Likely due to timezone/business hours restrictions (US accounts won't send until ~8 AM PT)

## 7. Next Session Recommendations

1. **Monitor Queue Processing** - Check if US accounts start sending during business hours
2. **Investigate Failed Items** - 55 failed items across accounts need review
3. **Migration Planning** - If proceeding with GCP migration, start with infrastructure assessment

## 8. Notification Kill Switch

Added a global kill switch to pause all Google Chat and Slack notifications.

### Environment Variable

```bash
PAUSE_NOTIFICATIONS=true  # Set in Netlify env vars
```

### Files Modified

- `lib/notifications/google-chat.ts` - Added kill switch to:
  - `sendGoogleChatNotification()` - main send function
  - `sendReplyAgentHITLNotification()` - Reply Agent HITL approvals

- `lib/slack.ts` - Added kill switch to:
  - `sendBotMessage()` - Slack Bot API messages
  - `sendMessage()` - Slack webhook messages

### How It Works

When `PAUSE_NOTIFICATIONS=true`:
- All notification functions return `{ success: true, error: 'Notifications paused' }`
- Messages are silently skipped (no errors thrown)
- Logs show: `⏸️ Notifications paused (PAUSE_NOTIFICATIONS=true)`

### To Resume Notifications

```bash
netlify env:unset PAUSE_NOTIFICATIONS
# Or set to any value other than 'true'
netlify env:set PAUSE_NOTIFICATIONS false
```

### Why This Was Added

User requested pausing all technical updates being published to Google Chat and Slack channels.

---

**Last Updated:** December 30, 2025 ~11:00 AM UTC
**Session Focus:** Campaign monitoring, status verification, and notification management
