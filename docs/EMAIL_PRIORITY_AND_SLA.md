# SAM AI Email Priority System & SLA

**Last Updated**: October 7, 2025
**Status**: ✅ Fully Implemented
**Critical**: Reply Agent Priority System Active

---

## Priority Levels

### 🔴 PRIORITY 1: Reply Agent (Prospect Campaign Replies)
**SLA**: < 15 minutes from prospect reply to HITL notification
**Processing**: **IMMEDIATE** - No batching, no delays

**When**: Prospect replies to a campaign email

**Flow**:
```
Prospect replies
  ↓ <1 min
Postmark receives
  ↓ <1 min
Webhook processes
  ↓ <2 min
Database stores + Sentiment analysis
  ↓ <2 min
SAM generates draft response
  ↓ <1 min
HITL receives priority notification email
  ↓
**Total: < 7 minutes** (under 15 min SLA ✅)
```

**Email Subject**: `🟢/🔴/🟡 {Prospect Name} replied to your campaign`
**Email Tag**: `reply-notification-priority`
**Database Priority Flag**: `urgent`

**Features**:
- **Instant notification** to all workspace members
- **Sentiment analysis** (positive/negative/neutral) in email
- **AI draft response** generated immediately
- **Direct link** to Reply UI with draft ready
- **No batching** - each reply triggers immediate notification

**Metrics to Monitor**:
```sql
-- Check Reply Agent processing times
SELECT
  id,
  received_at,
  processed_at,
  EXTRACT(EPOCH FROM (processed_at - received_at)) as processing_seconds
FROM email_responses
WHERE intent = 'campaign_reply'
ORDER BY received_at DESC
LIMIT 20;

-- Alert if ANY reply takes > 900 seconds (15 min)
SELECT COUNT(*)
FROM email_responses
WHERE intent = 'campaign_reply'
  AND EXTRACT(EPOCH FROM (processed_at - received_at)) > 900
  AND received_at > NOW() - INTERVAL '24 hours';
```

---

### 🟡 PRIORITY 2: Research Requests (HITL → Sam)
**SLA**: < 5 minutes for SAM response
**Processing**: **IMMEDIATE** with AI generation

**When**: User emails hello@sam.innovareai.com with questions/requests

**Flow**:
```
User emails SAM
  ↓ <1 min
Webhook receives
  ↓ <1 min
Create conversation thread
  ↓ <2 min
SAM AI generates response
  ↓ <1 min
Send email reply to user
  ↓
**Total: < 5 minutes**
```

**Email Subject**: `Re: {User's subject}`
**Email Tag**: `sam-email-reply`

**Features**:
- SAM can access MCP tools for research
- Full conversation thread created
- Email reply includes link to dashboard conversation
- Unknown users get signup prompt

---

### 🟢 PRIORITY 3: Approvals & Status Updates (Sam → HITL)
**SLA**: Daily digest (morning) or Weekly digest
**Processing**: **BATCHED** for efficiency

**When**: Campaign approvals, status updates, notifications

**Batching Schedule**:
- **Daily Digest**: 8:00 AM user's timezone
- **Weekly Digest**: Monday 8:00 AM

**Flow**:
```
Events accumulate throughout day/week
  ↓
Cron job runs at scheduled time
  ↓
Compile digest email
  ↓
Send single notification
```

**Email Subject**: `📊 Your SAM AI Daily Digest` or `📊 Weekly Campaign Summary`
**Email Tag**: `digest-notification`

**Features**:
- Reduce notification fatigue
- Group related updates
- Summary statistics
- Actionable insights

**Future Implementation**:
```typescript
// app/api/cron/send-daily-digest/route.ts
export async function GET() {
  // 1. Get all pending notifications from last 24 hours
  // 2. Group by workspace
  // 3. For each workspace:
  //    - Campaign approval requests
  //    - Campaign status updates
  //    - Performance summaries
  // 4. Send single digest email
  // 5. Mark notifications as sent
}
```

---

## Implementation Details

### Flow 2: Reply Agent (Priority 1)

#### Webhook Handler
```typescript
// app/api/webhooks/postmark-inbound/route.ts:272-332

async function handleCampaignReply(email, context, emailId) {
  console.log('🚨 PRIORITY: Campaign reply received')

  // 1. Store with HIGH PRIORITY flag
  const { data: reply } = await supabase
    .from('campaign_replies')
    .insert({
      campaign_id: context.campaignId,
      prospect_id: context.prospectId,
      reply_text: email.TextBody,
      reply_html: email.HtmlBody,
      priority: 'urgent',  // ← Priority flag
      requires_review: true
    })

  // 2. IMMEDIATE notification (no delay)
  await notifyUserOfReply(email, context, reply.id)

  // 3. Generate SAM draft (parallel processing)
  await generateReplyDraft(reply.id, context, email)

  console.log('✅ Campaign reply processed (priority: urgent)')
}
```

#### Priority Notification Email
```typescript
// app/api/webhooks/postmark-inbound/route.ts:493-612

async function notifyUserOfReply(email, context, replyId) {
  // Get all workspace members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, users(email, first_name)')
    .eq('workspace_id', campaign.workspace_id)
    .in('role', ['owner', 'admin', 'member'])

  // Detect sentiment for priority indication
  const sentiment = await detectSentiment(email.TextBody)
  const urgencyEmoji = sentiment === 'positive' ? '🟢' : '🔴'

  // Send to ALL team members IMMEDIATELY
  for (const member of members) {
    await postmark.sendEmail({
      Subject: `${urgencyEmoji} ${prospect.name} replied to your campaign`,
      HtmlBody: `
        <div style="background:#8907FF;">
          <h2>🚨 New Reply - Immediate Action Required</h2>
        </div>
        <blockquote>${email.TextBody}</blockquote>
        <a href="https://app.meet-sam.com/replies/${replyId}">
          View & Draft Response
        </a>
        <p>I'm drafting a suggested response for you. It'll be ready when you open the Reply Agent.</p>
      `,
      Tag: 'reply-notification-priority',
      Metadata: { priority: 'urgent' }
    })
  }
}
```

#### SAM Draft Generation
```typescript
// app/api/webhooks/postmark-inbound/route.ts:760-853

async function generateReplyDraft(replyId, context, email) {
  console.log('🤖 Generating SAM draft response (priority)')

  // Get campaign and prospect context
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('name, message_template, workspace_id')

  const { data: prospect } = await supabase
    .from('workspace_prospects')
    .select('name, company, title, industry')

  // Call OpenRouter AI (Claude 3.5 Sonnet)
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{
        role: 'system',
        content: `Generate professional, personalized response to prospect's reply.

Context:
- Campaign: ${campaign.name}
- Prospect: ${prospect.name} at ${prospect.company}
- Their reply: "${email.TextBody}"

Create 2-3 paragraph response that moves toward meeting/call.`
      }],
      max_tokens: 500
    })
  })

  const draftResponse = data.choices[0].message.content

  // Save to database
  await supabase
    .from('campaign_replies')
    .update({
      ai_suggested_response: draftResponse,
      draft_generated_at: new Date().toISOString()
    })
    .eq('id', replyId)
}
```

---

## Database Schema Updates

### campaign_replies table

```sql
ALTER TABLE campaign_replies ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE campaign_replies ADD COLUMN IF NOT EXISTS email_response_id UUID REFERENCES email_responses(id);
ALTER TABLE campaign_replies ADD COLUMN IF NOT EXISTS ai_suggested_response TEXT;
ALTER TABLE campaign_replies ADD COLUMN IF NOT EXISTS draft_generated_at TIMESTAMPTZ;
ALTER TABLE campaign_replies ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Index for priority queries
CREATE INDEX IF NOT EXISTS idx_campaign_replies_priority
  ON campaign_replies(priority, received_at DESC)
  WHERE requires_review = TRUE;

-- Index for SLA monitoring
CREATE INDEX IF NOT EXISTS idx_campaign_replies_sla
  ON campaign_replies(received_at, draft_generated_at)
  WHERE priority = 'urgent';
```

### email_responses table

```sql
-- Already has these columns from migration
-- processed: BOOLEAN
-- processed_at: TIMESTAMPTZ
-- sentiment: TEXT ('positive', 'negative', 'neutral')
-- intent: TEXT ('campaign_reply', 'research_request', 'approval', etc.)
-- requires_response: BOOLEAN

-- Add index for SLA monitoring
CREATE INDEX IF NOT EXISTS idx_email_responses_sla
  ON email_responses(received_at, processed_at)
  WHERE intent = 'campaign_reply';
```

---

## Monitoring & Alerts

### SLA Compliance Dashboard

```sql
-- Reply Agent SLA: < 15 minutes
WITH reply_sla AS (
  SELECT
    id,
    received_at,
    processed_at,
    EXTRACT(EPOCH FROM (processed_at - received_at)) / 60 as minutes,
    CASE
      WHEN EXTRACT(EPOCH FROM (processed_at - received_at)) / 60 < 15 THEN 'within_sla'
      ELSE 'sla_breach'
    END as sla_status
  FROM email_responses
  WHERE intent = 'campaign_reply'
    AND received_at > NOW() - INTERVAL '7 days'
)
SELECT
  DATE(received_at) as date,
  COUNT(*) as total_replies,
  COUNT(*) FILTER (WHERE sla_status = 'within_sla') as within_sla,
  COUNT(*) FILTER (WHERE sla_status = 'sla_breach') as sla_breaches,
  ROUND(AVG(minutes), 2) as avg_minutes,
  ROUND(MAX(minutes), 2) as max_minutes
FROM reply_sla
GROUP BY DATE(received_at)
ORDER BY date DESC;
```

### Real-Time Alert Query

```sql
-- Alert if any reply is pending > 15 minutes
SELECT
  id,
  from_email as prospect,
  received_at,
  NOW() - received_at as time_pending,
  EXTRACT(EPOCH FROM (NOW() - received_at)) / 60 as minutes_pending
FROM email_responses
WHERE intent = 'campaign_reply'
  AND processed = FALSE
  AND received_at < NOW() - INTERVAL '15 minutes';

-- If this returns ANY rows, trigger alert
```

### Postmark Webhook Logs

Check Postmark Activity for webhook delivery times:
1. Go to Postmark → Activity → Inbound
2. Click on email
3. Check "Webhook" section:
   - Time received
   - Time webhook called
   - Response time
   - HTTP status

**Target**: Webhook should return 200 OK within 5 seconds

---

## Testing

### Test Priority Reply Flow

```bash
# Send test campaign reply
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "interested-prospect@company.com",
    "FromName": "John Smith",
    "FromFull": {"Email": "interested-prospect@company.com", "Name": "John Smith"},
    "To": "reply+campaign123+prospect456@sam.innovareai.com",
    "ToFull": [{"Email": "reply+campaign123+prospect456@sam.innovareai.com", "MailboxHash": "reply-campaign123-prospect456"}],
    "Subject": "Re: Your outreach about AI solutions",
    "TextBody": "Hi! Very interested in learning more. Can we schedule a call next week?",
    "Date": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "MessageID": "test-reply-'$(date +%s)'"
  }'

# Expected Result:
# - ✅ Email saved to database (<1 sec)
# - ✅ Sentiment detected as "positive" (<1 sec)
# - ✅ Priority notification sent (<2 sec)
# - ✅ Draft response generated (<5 sec)
# - ✅ Total time: <10 seconds
```

### Verify SLA Compliance

```bash
# Check if test reply met SLA
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data } = await supabase
    .from('email_responses')
    .select('received_at, processed_at')
    .eq('intent', 'campaign_reply')
    .order('received_at', { ascending: false })
    .limit(1)
    .single();

  const seconds = (new Date(data.processed_at) - new Date(data.received_at)) / 1000;
  console.log(\`Processing time: \${seconds} seconds\`);
  console.log(\`SLA (900s): \${seconds < 900 ? '✅ MET' : '❌ BREACH'}\`);
})();
"
```

---

## Future Enhancements

### Phase 1: Real-Time Dashboard
- Live view of pending replies
- SLA countdown timers
- Draft response previews
- One-click send

### Phase 2: Mobile Push Notifications
- Instant mobile alerts for high-priority replies
- In-app notification center
- SMS fallback for urgent replies

### Phase 3: AI Auto-Response (with approval)
- SAM sends draft automatically
- User can approve/edit/reject within 30 min
- Auto-send if not reviewed

### Phase 4: Team Assignment
- Route replies to specific team members
- Round-robin assignment
- Skill-based routing

---

## Summary

| Flow | Priority | SLA | Processing | Notification |
|------|----------|-----|------------|--------------|
| **Reply Agent** | 🔴 P1 | <15 min | **Immediate** | Email + Dashboard |
| **Research** | 🟡 P2 | <5 min | **Immediate** | Email reply |
| **Approvals** | 🟢 P3 | Daily/Weekly | **Batched** | Digest email |

**Critical Success Factor**: Reply Agent must ALWAYS meet <15 min SLA

**Implementation Status**:
- ✅ Priority 1 (Reply Agent): Fully implemented
- ✅ Priority 2 (Research): Fully implemented
- ⚠️ Priority 3 (Digest): To be implemented

**Production Ready**: Yes for P1 & P2 ✅

---

**Last Updated**: October 7, 2025
**Version**: 1.0
**Critical SLA**: Reply Agent <15 minutes
