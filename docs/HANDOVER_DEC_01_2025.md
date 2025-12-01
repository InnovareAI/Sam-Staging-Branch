# Handover Document - December 1, 2025

## Session Summary

This session focused on implementing Google Chat notifications for health check agents and campaign activity, plus verifying Netlify scheduled functions are running correctly.

---

## Changes Made

### 1. Google Chat Notifications - Health Checks

**Purpose:** Send automated status updates when health check agents complete.

**New File:** [lib/notifications/google-chat.ts](../lib/notifications/google-chat.ts)

**Features:**
- `sendGoogleChatNotification()` - Core webhook sender
- `sendHealthCheckNotification()` - Formatted card for health checks
- `sendGoogleChatText()` - Simple text messages
- Supports cardsV2 format with headers, sections, widgets

**Integration Points:**
- [daily-health-check/route.ts](../app/api/agents/daily-health-check/route.ts) - Sends notification after check completes
- [qa-monitor/route.ts](../app/api/agents/qa-monitor/route.ts) - Sends notification after check completes

**Environment Variable:** `GOOGLE_CHAT_WEBHOOK_URL`

---

### 2. Google Chat Notifications - Campaign Replies

**Purpose:** Real-time notifications when prospects reply to campaigns (IA1-IA7 workspaces only).

**Functions Added to google-chat.ts:**
- `sendCampaignReplyNotification()` - Sends reply alerts with intent classification
- `shouldSendReplyNotification()` - Checks if workspace is IA1-IA7

**Workspace IDs Configured:**
```typescript
const IA_WORKSPACE_IDS = [
  'babdcab8-1a78-4b2f-913e-6e9fd9821009', // IA1
  '04666209-fce8-4d71-8eaf-01278edfc73b', // IA2
  '96c03b38-a2f4-40de-9e16-43098599e1d4', // IA3
  '7f0341da-88db-476b-ae0a-fc0da5b70861', // IA4
  'cd57981a-e63b-401c-bde1-ac71752c2293', // IA5
  '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', // IA6
  // IA7 - add when created
];
```

**Integration Point:** [unipile-messages/route.ts](../app/api/webhooks/unipile-messages/route.ts)

**Notification Format:**
- Intent emoji (🟢 interested, 🔥 booking_request, ❓ question, etc.)
- Prospect name and company
- Message preview (truncated to 500 chars)
- AI-generated draft reply preview
- "View in SAM" button

**Environment Variable:** `GOOGLE_CHAT_REPLIES_WEBHOOK_URL`

---

### 3. Daily Campaign Summary

**Purpose:** Daily report of campaign activity posted to Google Chat replies channel.

**New Files:**
- [app/api/agents/daily-campaign-summary/route.ts](../app/api/agents/daily-campaign-summary/route.ts)
- [netlify/functions/daily-campaign-summary.ts](../netlify/functions/daily-campaign-summary.ts)

**Metrics Reported:**
- Connection requests sent (total + by workspace)
- Connections accepted (count + rate)
- Replies received (count + rate + intent breakdown)
- Follow-up messages sent

**Schedule:** Daily at 4 PM UTC (8 AM PT)

**Configuration in netlify.toml:**
```toml
[functions."daily-campaign-summary"]
  schedule = "0 16 * * *"
```

---

### 4. Weekend Execution Verification

**Finding:** Confirmed Netlify scheduled functions ARE running correctly over weekends.

**Evidence from database:**
- Health checks ran at 7 AM on Nov 30 and Dec 1
- 263 prospect updates were processed
- 0 messages sent (expected - business hours skip weekends)

**Script Created:** [scripts/js/check-weekend-execution.mjs](../scripts/js/check-weekend-execution.mjs)

---

## Environment Variables Added to Netlify

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CHAT_WEBHOOK_URL` | Health check notifications channel |
| `GOOGLE_CHAT_REPLIES_WEBHOOK_URL` | Campaign replies notifications channel |

---

## Commits Made

1. Google Chat notification helper + health check integration
2. Campaign reply notifications for IA workspaces
3. `4ead35c4` - Add daily campaign summary to Google Chat replies channel

---

## Production Status

- **Deployed:** December 1, 2025
- **URL:** https://app.meet-sam.com
- **All notifications tested and working**

---

## Testing Commands

### Test Daily Health Check
```bash
curl -s -X POST "https://app.meet-sam.com/api/agents/daily-health-check" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### Test Daily Campaign Summary
```bash
curl -s -X POST "https://app.meet-sam.com/api/agents/daily-campaign-summary" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### Manually Trigger Reply Notification
Reply notifications are triggered automatically via the Unipile webhook when a prospect sends a message.

---

## Scheduled Functions Overview

| Function | Schedule | Description |
|----------|----------|-------------|
| `process-send-queue` | Every minute | Send queued messages |
| `process-pending-prospects` | Every 5 min | Process new prospects |
| `poll-accepted-connections` | Every 15 min | Check for accepted CRs |
| `poll-message-replies` | Every 15 min | Check for new replies |
| `send-follow-ups` | Every 30 min | Send due follow-ups |
| `rate-limit-monitor` | Every 30 min | Monitor LinkedIn limits |
| `qa-monitor` | 6 AM UTC | Pipeline health check |
| `daily-health-check` | 7 AM UTC | System health check |
| `data-quality-check` | Monday 8 AM UTC | Weekly cleanup |
| `daily-campaign-summary` | 4 PM UTC (8 AM PT) | Daily stats report |

---

## Query/Search Capabilities (Existing)

User asked about query capabilities. Current state:

### What Exists
| Endpoint | Query Options |
|----------|--------------|
| `GET /api/campaigns/[id]/prospects` | status, pagination |
| `GET /api/prospects` | status, search (name/email/company/title), pagination |
| `GET /api/prospect-approval/prospects` | status, sort_by, sort_order, pagination |

### What's Missing
- Campaign search by name/description
- Advanced prospect filters (date range, industry, response status)
- Cross-campaign prospect search
- Custom query builder

---

## Files Modified/Created

| File | Type | Changes |
|------|------|---------|
| `lib/notifications/google-chat.ts` | NEW | Full notification helper (648 lines) |
| `app/api/agents/daily-campaign-summary/route.ts` | NEW | Daily summary endpoint |
| `netlify/functions/daily-campaign-summary.ts` | NEW | Scheduled function wrapper |
| `app/api/agents/daily-health-check/route.ts` | MODIFIED | Added Google Chat notification |
| `app/api/agents/qa-monitor/route.ts` | MODIFIED | Added Google Chat notification |
| `app/api/webhooks/unipile-messages/route.ts` | MODIFIED | Added reply notification |
| `netlify.toml` | MODIFIED | Added daily-campaign-summary schedule |
| `scripts/js/check-weekend-execution.mjs` | NEW | Weekend verification script |
| `docs/GOOGLE_CHAT_NOTIFICATIONS.md` | NEW | Setup documentation |

---

## Next Steps

1. **Monitor daily summary** - First automatic run at 4 PM UTC (8 AM PT)
2. **Add IA7 workspace ID** when created - update `IA_WORKSPACE_IDS` array
3. **Consider adding more metrics** to daily summary (campaign-level stats, top performers)
4. **Optional: Add campaign search** functionality if users request it

---

## Important Notes

1. **Reply notifications are workspace-filtered** - Only IA1-IA7 workspaces get Google Chat alerts
2. **Daily summary runs at end of day PT** - 8 AM PT captures previous day's activity
3. **Health checks have their own channel** - Separate from reply notifications
4. **Organic leads get special formatting** - "🌟 Organic Lead" banner for non-campaign contacts

---

**Last Updated:** December 1, 2025
**Author:** Claude Code
