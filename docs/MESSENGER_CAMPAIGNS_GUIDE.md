# Messenger Campaign Guide

**Date:** November 30, 2025
**Feature:** Messenger Campaign Type
**Status:** ✅ Fully Implemented

---

## Overview

Messenger campaigns allow you to send LinkedIn messages to prospects who are **already connected** to your LinkedIn account. Unlike connector campaigns that start with a connection request, messenger campaigns skip directly to messaging.

### Key Difference

| Campaign Type | Connection Request | Target Audience | Use Case |
|--------------|-------------------|-----------------|----------|
| **Connector** | ✅ Sends CR first | 2nd/3rd degree connections | Building new connections |
| **Messenger** | ❌ No CR sent | 1st degree (already connected) | Engaging existing network |

---

## When to Use Messenger Campaigns

✅ **Good Use Cases:**
- Following up with existing connections
- Re-engaging dormant connections
- Sending value content to your network
- Event invitations to connections
- Product updates to connected prospects

❌ **Wrong Use Cases:**
- Reaching out to people you're NOT connected with (use Connector instead)
- Cold outreach (requires connection request first)

---

## How It Works

### 1. Campaign Creation

Create a messenger campaign via the Campaign Hub or API:

```typescript
const campaign = {
  workspace_id: 'your-workspace-id',
  name: 'Q4 Product Update - Existing Connections',
  campaign_type: 'messenger', // CRITICAL: Must be 'messenger'
  message_templates: {
    connection_request: 'Hi {first_name}, hope you're doing well...', // First message
    follow_up_messages: [
      'Just following up on my previous message...', // Follow-up 1
      'Quick case study I thought you'd find interesting...' // Follow-up 2
    ],
    follow_up_delays: [3, 5, 7] // Days between messages
  },
  status: 'draft'
}
```

### 2. Upload Connected Prospects

**CRITICAL:** All prospects MUST be 1st degree connections.

Upload prospects via CSV with these columns:
- `first_name` (required)
- `last_name` (required)
- `linkedin_url` (required - must be full profile URL)
- `company_name` (optional)
- `title` (optional)

Example CSV:
```csv
first_name,last_name,linkedin_url,company_name,title
John,Smith,https://linkedin.com/in/johnsmith123,Acme Corp,CEO
Jane,Doe,https://linkedin.com/in/janedoe456,Tech Inc,CTO
```

### 3. Launch Campaign

Click "Execute" in Campaign Hub. The system will:

1. **Validate connections:** Check that each prospect is FIRST_DEGREE connected
2. **Queue messages:** Create send_queue entries for all messages
3. **Schedule delivery:** Space messages 30 minutes apart (first message), then follow configured delays

### 4. Automated Execution

The cron job (`/api/cron/process-send-queue`) runs every minute and:

1. Finds due messages in queue
2. For messenger campaigns:
   - Looks up existing chat with prospect
   - Sends message via `/api/v1/chats/{chatId}/messages`
3. Updates prospect status to `messaging`
4. Schedules next message based on delays

---

## Architecture

### Database Schema

**Campaigns Table:**
```sql
campaign_type = 'messenger' -- Identifies messenger campaigns
message_templates = {
  "connection_request": "First message text...",
  "follow_up_messages": ["FU1", "FU2", "FU3"],
  "follow_up_delays": [3, 5, 7] -- Days between messages
}
```

**Send Queue Table:**
```sql
message_type = 'direct_message_1' | 'direct_message_2' | ... -- Not 'connection_request'
requires_connection = false -- Messages send immediately (already connected)
status = 'pending' | 'sent' | 'skipped' | 'failed'
```

**Prospect Status Flow:**
```
pending/approved → connected → messaging
```

### API Endpoints

#### Queue Messages
```bash
POST /api/campaigns/direct/send-messages-queued
Body: { campaignId: "uuid" }

Response:
{
  "success": true,
  "queued": 45,
  "skipped": 5,
  "totalMessages": 135,
  "message": "Queued 135 messages for 45 prospects"
}
```

**Validation:** Checks all prospects are FIRST_DEGREE before queuing.

#### Process Queue (Cron)
```bash
POST /api/cron/process-send-queue
Header: x-cron-secret: ${CRON_SECRET}

Runs every minute via Netlify scheduled functions
```

---

## Message Delivery

### Unipile API Flow

**Connector Campaign (sends CR):**
```javascript
POST /api/v1/users/invite
{
  "account_id": "unipile_account_id",
  "provider_id": "ACo...",
  "message": "Connection request text"
}
```

**Messenger Campaign (sends direct message):**
```javascript
// 1. Find chat
GET /api/v1/chats?account_id=unipile_account_id

// 2. Send message to chat
POST /api/v1/chats/{chatId}/messages
{
  "text": "Message content"
}
```

### Rate Limiting

Same as connector campaigns:
- **Spacing:** 30 minutes between prospects (first message)
- **Daily Cap:** 20 messages per LinkedIn account per day
- **Business Hours:** Respects campaign schedule settings
- **Weekends/Holidays:** Skipped by default (configurable)

---

## Error Handling

### Common Errors

**1. Prospect Not Connected**
```
Error: "Not connected (SECOND_DEGREE) - messenger campaigns require existing connection"
Status: 'failed'
Action: Prospect skipped, marked as failed with note
```

**2. Chat Not Found**
```
Error: "No chat found for prospect - connection may not be accepted yet"
Status: 'failed'
Action: Message marked as failed, can be retried manually
```

**3. LinkedIn Profile Not Accessible**
```
Error: "Could not access LinkedIn profile"
Status: 'skipped'
Action: Prospect skipped during validation
```

### Validation Results

The queue endpoint returns detailed results:

```json
{
  "success": true,
  "queued": 40,
  "skipped": 8,
  "errors": 2,
  "results": [
    {
      "prospectId": "uuid",
      "name": "John Smith",
      "status": "queued",
      "messagesQueued": 3
    },
    {
      "prospectId": "uuid",
      "name": "Jane Doe",
      "status": "skipped",
      "reason": "Not connected (SECOND_DEGREE)"
    }
  ]
}
```

---

## Monitoring

### Check Queue Status

```sql
-- See all pending messages for a campaign
SELECT
  message_type,
  scheduled_for,
  status,
  COUNT(*)
FROM send_queue
WHERE campaign_id = 'your-campaign-id'
GROUP BY message_type, scheduled_for, status
ORDER BY scheduled_for;
```

### Check Prospect Status

```sql
-- See campaign progress
SELECT
  status,
  COUNT(*) as count
FROM campaign_prospects
WHERE campaign_id = 'your-campaign-id'
GROUP BY status;
```

### View Sent Messages

```sql
-- See all sent messages with timestamps
SELECT
  cp.first_name,
  cp.last_name,
  sq.message_type,
  sq.sent_at,
  sq.status
FROM send_queue sq
JOIN campaign_prospects cp ON sq.prospect_id = cp.id
WHERE sq.campaign_id = 'your-campaign-id'
  AND sq.status = 'sent'
ORDER BY sq.sent_at DESC;
```

---

## Testing

### Test Checklist

- [ ] Create messenger campaign via UI
- [ ] Upload CSV with connected prospects
- [ ] Launch campaign
- [ ] Verify queue created (`send_queue` table)
- [ ] Check first message sent after 1 minute (cron runs)
- [ ] Verify message appears in LinkedIn chat
- [ ] Confirm prospect status updated to `messaging`
- [ ] Wait for follow-up delay, verify second message sent

### Test with Mixed Prospects

Upload a CSV with:
- 5 connected prospects (should queue successfully)
- 3 not connected (should be skipped with error)

Expected result:
```json
{
  "queued": 5,
  "skipped": 3,
  "totalMessages": 15 // 5 prospects × 3 messages each
}
```

---

## Deployment

### 1. Run Database Migration

```bash
# Apply the messenger campaign schema
psql $DATABASE_URL < sql/migrations/014-messenger-campaign-support.sql
```

### 2. Deploy Code

```bash
# Deploy to production
netlify deploy --prod
```

### 3. Verify Cron Job

Ensure Netlify scheduled functions is configured:
- URL: `https://app.meet-sam.com/api/cron/process-send-queue`
- Schedule: `* * * * *` (every minute)
- Header: `x-cron-secret: ${CRON_SECRET}`

---

## Troubleshooting

### Messages Not Sending

1. **Check queue status:**
   ```sql
   SELECT * FROM send_queue WHERE campaign_id = 'uuid' AND status = 'pending' LIMIT 10;
   ```

2. **Check cron job logs:**
   ```bash
   netlify logs --function process-send-queue --tail
   ```

3. **Verify LinkedIn account:**
   ```sql
   SELECT * FROM workspace_accounts WHERE workspace_id = 'uuid' AND platform = 'linkedin';
   ```

### Prospects Showing as Not Connected

1. **Verify connection in LinkedIn:** Check if you're actually connected
2. **Check Unipile profile data:**
   ```bash
   curl -X GET "https://api6.unipile.com:13670/api/v1/users/profile?account_id=ACCOUNT_ID&provider_id=PROVIDER_ID" \
     -H "X-API-KEY: $UNIPILE_API_KEY"
   ```
3. **Expected response:** `network_distance: "FIRST_DEGREE"`

### Follow-ups Not Sending

1. **Check message_type in queue:**
   ```sql
   SELECT message_type, requires_connection, scheduled_for, status
   FROM send_queue
   WHERE prospect_id = 'uuid';
   ```

2. **Verify all messages queued:**
   - Should have `direct_message_1`, `direct_message_2`, etc.
   - All `requires_connection = false`

3. **Check scheduled times:**
   - Follow-ups should be `scheduled_for` days after previous message
   - Confirm not blocked by weekends/holidays

---

## Best Practices

### Message Content

✅ **Good:**
- Personalized with `{first_name}`, `{company_name}`
- Clear value proposition
- Respectful of existing relationship
- Spaced appropriately (don't spam)

❌ **Avoid:**
- Generic sales pitches
- Too frequent messages (respect delays)
- Overly long messages
- All caps or excessive punctuation

### Timing

- **First message:** 9 AM - 12 PM (highest engagement)
- **Follow-ups:** 3-7 days apart
- **Max messages:** 3-5 per prospect (don't overdo it)

### Targeting

- **Segment by role:** Different messages for CEOs vs ICs
- **Industry-specific:** Tailor value props to industry
- **Engagement history:** Skip prospects who never responded in past

---

## Migration from Connector to Messenger

If you have existing connections from connector campaigns:

```sql
-- Find connected prospects from connector campaigns
SELECT
  cp.id,
  cp.first_name,
  cp.last_name,
  cp.linkedin_url,
  c.name as campaign_name
FROM campaign_prospects cp
JOIN campaigns c ON cp.campaign_id = c.id
WHERE c.campaign_type = 'connector'
  AND cp.status = 'connected'
  AND cp.connection_accepted_at IS NOT NULL;

-- Export to CSV, create messenger campaign with this list
```

---

## Roadmap

### Planned Features

- [ ] **Dynamic Delays:** AI-suggested follow-up timing based on engagement
- [ ] **A/B Testing:** Test different message variations
- [ ] **Reply Detection:** Auto-pause campaign when prospect replies
- [ ] **Sentiment Analysis:** Adjust tone based on prospect interaction
- [ ] **Performance Analytics:** Detailed metrics per message variant

### Known Limitations

- **LinkedIn Restrictions:** Cannot send messages to connections with messaging disabled
- **Chat Creation Lag:** If LinkedIn hasn't created chat yet, message will fail (retry manually)
- **No InMail Support:** Messenger only works with 1st degree connections (use InMail for premium)

---

## Support

**Questions?**
- Slack: #sam-campaigns
- Email: support@meet-sam.com
- Documentation: https://docs.meet-sam.com/messenger-campaigns

**Bug Reports:**
- File issue: https://github.com/innovareai/sam/issues
- Include: Campaign ID, prospect LinkedIn URL, error message

---

**Last Updated:** November 30, 2025
**Version:** 1.0.0
**Author:** Claude (AI Assistant)
