# Follow-up Agent Implementation Guide

**Created**: October 30, 2025
**Status**: ✅ Production Ready
**Purpose**: Automated prospect re-engagement for silent prospects after Reply Agent

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Deployment Guide](#deployment-guide)
5. [Configuration](#configuration)
6. [Testing Guide](#testing-guide)
7. [Monitoring](#monitoring)
8. [Tone Examples](#tone-examples)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### Purpose

The **Follow-up Agent** automatically re-engages prospects who have gone silent after receiving a response from the Reply Agent. It sends a progressive sequence of follow-up messages with varying tones:

- **Attempt 1 (3 days)**: Gentle nudge - assumes they're busy
- **Attempt 2 (7 days)**: Value-add - provides new resource/insight
- **Attempt 3 (14 days)**: Final attempt - permission to close

### Key Features

✅ **AI-Powered Message Generation**
- Claude 3.5 Sonnet generates contextual follow-ups
- References previous conversation history
- Uses company enrichment data when available
- Varies tone based on attempt number

✅ **Smart Timing**
- Progressive delays (3d → 7d → 14d)
- Business hours validation (M-F, 8am-6pm)
- Auto-cancels if prospect replies

✅ **Multi-Channel Support**
- Email via Unipile/Postmark
- LinkedIn via Unipile
- Uses existing message_outbox infrastructure

✅ **Multi-Tenant**
- Single N8N workflow serves all workspaces
- RLS policies ensure data isolation
- Workspace-level configuration

---

## Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Follow-up Agent Workflow                      │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ 1. N8N Schedule Trigger (Every 60 seconds)                       │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. Poll Ready Follow-ups                                          │
│    GET /api/follow-ups/poll-ready                                 │
│    ↳ Queries: follow_ups_ready_to_send view                      │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. For Each Ready Follow-up:                                      │
│    ├─ POST /api/follow-ups/generate                              │
│    │  ↳ Generates AI follow-up message                           │
│    ├─ POST /api/message-outbox/queue                             │
│    │  ↳ Queues message for delivery                              │
│    └─ PUT /api/follow-ups/{id}/status                            │
│       ↳ Updates status to 'sent'                                 │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. Message Outbox Processor (Existing)                           │
│    Sends via Unipile/Postmark                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Database Triggers

```sql
-- Auto-create follow-up when Reply Agent sends message
CREATE TRIGGER trigger_create_follow_up_on_reply_sent
  AFTER UPDATE OF response_sent_at ON campaign_replies
  WHEN (OLD.response_sent_at IS NULL AND NEW.response_sent_at IS NOT NULL)
  EXECUTE FUNCTION create_follow_up_sequence();

-- Auto-cancel follow-up when prospect replies
CREATE TRIGGER trigger_reset_follow_up_on_reply
  AFTER INSERT ON campaign_replies
  WHEN (NEW.reply_text IS NOT NULL)
  EXECUTE FUNCTION reset_follow_up_on_prospect_reply();
```

---

## Database Schema

### Tables

#### `prospect_follow_ups`

Tracks follow-up sequences for each prospect.

```sql
CREATE TABLE prospect_follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  prospect_id UUID NOT NULL,

  -- Follow-up sequence
  follow_up_attempt INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,

  -- Timing
  last_contacted_at TIMESTAMPTZ NOT NULL,
  next_follow_up_date TIMESTAMPTZ NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status Values**:
- `pending` - Waiting for scheduled date
- `ready` - Ready to send (view filter)
- `sent` - Follow-up sent
- `cancelled` - Prospect replied, sequence cancelled
- `completed` - All attempts exhausted
- `paused` - Manually paused by user

#### `follow_up_templates` (Optional)

Workspace-level custom templates.

```sql
CREATE TABLE follow_up_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  template_name TEXT NOT NULL,
  follow_up_attempt INTEGER NOT NULL, -- 1, 2, or 3
  tone TEXT NOT NULL, -- 'gentle', 'value-add', 'final-attempt'
  subject_template TEXT,
  message_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Views

#### `follow_ups_ready_to_send`

N8N queries this view every minute.

```sql
CREATE VIEW follow_ups_ready_to_send AS
SELECT
  fu.id,
  fu.prospect_id,
  p.first_name || ' ' || p.last_name AS prospect_name,
  p.email AS prospect_email,
  p.company AS prospect_company,
  p.title AS prospect_title,
  p.linkedin_url AS prospect_linkedin_url,
  p.company_website,
  fu.campaign_id,
  c.name AS campaign_name,
  c.channel AS campaign_channel,
  fu.follow_up_attempt,
  fu.last_contacted_at,
  EXTRACT(DAY FROM NOW() - fu.last_contacted_at)::INTEGER AS days_since_last_contact,
  fu.workspace_id,
  jsonb_build_object(
    'initial_message', cr.initial_message,
    'our_reply', cr.response_sent,
    'their_reply', cr.reply_text
  ) AS conversation_history
FROM prospect_follow_ups fu
JOIN workspace_prospects p ON fu.prospect_id = p.id
JOIN campaigns c ON fu.campaign_id = c.id
LEFT JOIN campaign_replies cr ON cr.prospect_id = fu.prospect_id
WHERE fu.status = 'pending'
  AND fu.next_follow_up_date <= NOW()
  AND fu.follow_up_attempt <= fu.max_attempts;
```

---

## Deployment Guide

### Prerequisites

- ✅ Reply Agent deployed and functional
- ✅ N8N instance accessible (workflows.innovareai.com)
- ✅ Database migrations applied
- ✅ OpenRouter API key configured

### Step 1: Apply Database Migrations

```bash
# Run the migration (Supabase dashboard → SQL Editor)
# File: supabase/migrations/20251030000001_create_follow_up_agent.sql

-- Check migration status
SELECT * FROM supabase_migrations
ORDER BY created_at DESC
LIMIT 5;
```

### Step 2: Verify Database Objects

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('prospect_follow_ups', 'follow_up_templates');

-- Check view exists
SELECT viewname
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'follow_ups_ready_to_send';

-- Check triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%follow_up%';
```

### Step 3: Deploy N8N Workflow

```bash
# Set environment variables
export N8N_API_URL="https://workflows.innovareai.com/api/v1"
export N8N_API_KEY="your-n8n-api-key"

# Deploy workflow
node scripts/js/deploy-follow-up-agent-workflow.mjs
```

**Expected Output**:
```
🚀 Deploying Follow-up Agent Workflow...

📋 Workflow details:
   Name: Follow-up Agent - Automated Re-engagement
   Type: Schedule Trigger (polls every 60 seconds)
   Nodes: 13
   Purpose: Automated prospect re-engagement

✅ Workflow created!
   ID: abc123def456

✅ Follow-up Agent Workflow deployed and activated!

📊 Workflow Summary:
   - Workflow ID: abc123def456
   - Status: Active
   - Polling: Every 60 seconds
```

### Step 4: Verify Deployment

```bash
# Check workflow is active in N8N dashboard
open https://workflows.innovareai.com

# Test API endpoints
curl -X GET \
  "http://localhost:3000/api/follow-ups/poll-ready" \
  -H "x-internal-trigger: n8n-followup-agent"

# Should return:
# { "follow_ups": [], "count": 0, "polled_at": "2025-10-30T..." }
```

### Step 5: Deploy to Production

```bash
# Push to git
git add .
git commit -m "feat: Add Follow-up Agent for prospect re-engagement"
git push origin main

# Netlify auto-deploys (2-5 minutes)
# Verify at: https://app.meet-sam.com
```

---

## Configuration

### Environment Variables

No additional environment variables required. Follow-up Agent uses existing:

```bash
# OpenRouter (AI generation)
OPENROUTER_API_KEY=sk-or-...

# Supabase (database)
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# N8N (workflow automation)
N8N_API_URL=https://workflows.innovareai.com/api/v1
N8N_API_KEY=...
```

### Workspace-Level Settings

Future enhancement: Workspace-level configuration in `workspaces` table:

```json
{
  "follow_up_settings": {
    "enabled": true,
    "max_attempts": 3,
    "timing": {
      "attempt_1_days": 3,
      "attempt_2_days": 7,
      "attempt_3_days": 14
    },
    "business_hours_only": true,
    "use_enrichment": false,
    "custom_templates": {
      "attempt_1": "template_uuid",
      "attempt_2": "template_uuid",
      "attempt_3": "template_uuid"
    }
  }
}
```

---

## Testing Guide

### Test 1: Create Follow-up Manually

```sql
-- Insert test follow-up
INSERT INTO prospect_follow_ups (
  workspace_id,
  campaign_id,
  prospect_id,
  follow_up_attempt,
  last_contacted_at,
  next_follow_up_date,
  status
) VALUES (
  'your-workspace-id',
  'your-campaign-id',
  'your-prospect-id',
  1, -- First attempt
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '1 minute', -- Ready now
  'pending'
);

-- Check if it appears in view
SELECT * FROM follow_ups_ready_to_send;
```

### Test 2: Verify AI Generation

```bash
# Test follow-up generation endpoint
curl -X POST http://localhost:3000/api/follow-ups/generate \
  -H "Content-Type: application/json" \
  -H "x-internal-trigger: n8n-followup-agent" \
  -d '{
    "follow_up_id": "uuid",
    "prospect": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "company": "Example Corp",
      "title": "VP Sales"
    },
    "campaign": {
      "id": "uuid",
      "name": "Q4 Outreach",
      "channel": "email"
    },
    "conversation_history": {
      "our_reply": "Thanks for your interest! Here's how we can help..."
    },
    "follow_up_attempt": 1,
    "days_since_last_contact": 3,
    "workspace_id": "uuid"
  }'
```

**Expected Response**:
```json
{
  "follow_up_id": "uuid",
  "generated_subject": "Quick follow-up",
  "generated_message": "Hi John, I know things get busy...",
  "generated_tone": "gentle",
  "confidence_score": 0.85,
  "metadata": {
    "model": "claude-3.5-sonnet",
    "tokens_used": 245,
    "generation_time_ms": 1200
  }
}
```

### Test 3: End-to-End Flow

```bash
# 1. Manually trigger N8N workflow
# Go to N8N dashboard → Find "Follow-up Agent" workflow → Click "Execute"

# 2. Check logs in N8N execution view

# 3. Verify message queued to outbox
SELECT * FROM message_outbox
WHERE metadata->>'message_type' = 'follow_up'
ORDER BY created_at DESC
LIMIT 5;

# 4. Verify follow-up status updated
SELECT * FROM prospect_follow_ups
WHERE status = 'sent'
ORDER BY sent_at DESC
LIMIT 5;
```

### Test 4: Auto-Cancel on Reply

```sql
-- Simulate prospect reply
INSERT INTO campaign_replies (
  workspace_id,
  campaign_id,
  prospect_id,
  reply_text,
  received_at
) VALUES (
  'workspace-id',
  'campaign-id',
  'prospect-id',
  'Thanks for following up! I''m interested.',
  NOW()
);

-- Check follow-up was cancelled
SELECT * FROM prospect_follow_ups
WHERE prospect_id = 'prospect-id'
  AND status = 'cancelled';
```

---

## Monitoring

### Key Metrics to Track

```sql
-- Follow-ups sent today
SELECT
  campaign_channel,
  follow_up_attempt,
  COUNT(*) as count
FROM prospect_follow_ups
WHERE sent_at::DATE = CURRENT_DATE
GROUP BY campaign_channel, follow_up_attempt;

-- Conversion rate (follow-up → reply)
SELECT
  fu.follow_up_attempt,
  COUNT(DISTINCT fu.prospect_id) as follow_ups_sent,
  COUNT(DISTINCT cr.prospect_id) as got_replies,
  ROUND(
    COUNT(DISTINCT cr.prospect_id)::NUMERIC /
    NULLIF(COUNT(DISTINCT fu.prospect_id), 0) * 100,
    2
  ) as reply_rate_pct
FROM prospect_follow_ups fu
LEFT JOIN campaign_replies cr
  ON fu.prospect_id = cr.prospect_id
  AND cr.received_at > fu.sent_at
WHERE fu.sent_at >= NOW() - INTERVAL '30 days'
GROUP BY fu.follow_up_attempt
ORDER BY fu.follow_up_attempt;

-- Follow-ups by status
SELECT status, COUNT(*) as count
FROM prospect_follow_ups
GROUP BY status
ORDER BY count DESC;

-- Average time to reply after follow-up
SELECT
  fu.follow_up_attempt,
  AVG(EXTRACT(EPOCH FROM (cr.received_at - fu.sent_at)) / 3600) as avg_hours_to_reply
FROM prospect_follow_ups fu
JOIN campaign_replies cr
  ON fu.prospect_id = cr.prospect_id
  AND cr.received_at > fu.sent_at
WHERE fu.sent_at >= NOW() - INTERVAL '30 days'
GROUP BY fu.follow_up_attempt;
```

### N8N Monitoring

```bash
# Check workflow execution history
# N8N Dashboard → Executions → Filter by "Follow-up Agent"

# Look for:
- ✅ Successful executions every minute
- ❌ Any failed executions
- ⏱️ Average execution time (should be < 30 seconds)
```

### Logs to Monitor

```bash
# Application logs (Netlify Functions)
# https://app.netlify.com → Functions → Logs

# Search for:
"Follow-ups ready to send"
"Follow-up generated"
"Message queued to outbox"
"Follow-up status updated"

# Watch for errors:
"Error generating follow-up"
"Database error"
"Failed to queue message"
```

---

## Tone Examples

### Attempt 1: Gentle (3 days after last contact)

**Subject**: Quick follow-up

**Message**:
```
Hi Sarah,

I know things get busy! Just wanted to quickly follow up on our conversation about
streamlining your sales outreach.

Still interested in seeing how we helped TechCorp increase their response rates by 40%?

Let me know if you'd like to connect.

Best,
Sam
```

**Characteristics**:
- Short (2-3 sentences)
- Acknowledges they're busy
- Low pressure
- Specific reference to previous conversation
- Simple question

### Attempt 2: Value-Add (7 days after attempt 1)

**Subject**: Thought you might find this helpful

**Message**:
```
Hi Sarah,

I came across this case study on LinkedIn automation and thought of you given
your focus on scaling outreach at TechCorp.

It shows how companies in your space are using AI to personalize at scale -
pretty relevant to what we discussed.

Happy to share if helpful. Worth a quick 15-minute call?

Best,
Sam
```

**Characteristics**:
- Leads with NEW value
- References their specific situation
- No pressure ("if helpful")
- Provides concrete resource
- Suggests low-commitment call

### Attempt 3: Final Attempt (14 days after attempt 2)

**Subject**: Closing the loop

**Message**:
```
Hi Sarah,

I haven't heard back so I'm guessing timing isn't right. Totally understand -
I'll close this on my end.

Feel free to reach out anytime if things change.

Best,
Sam
```

**Characteristics**:
- Very short (2-3 sentences)
- Respectful assumptive close
- No guilt or pressure
- Leaves door open
- Professional tone

---

## Troubleshooting

### Issue 1: No Follow-ups Being Created

**Symptom**: `prospect_follow_ups` table is empty

**Diagnosis**:
```sql
-- Check if Reply Agent is sending messages
SELECT * FROM campaign_replies
WHERE response_sent_at IS NOT NULL
ORDER BY response_sent_at DESC
LIMIT 10;

-- Check if trigger exists
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_create_follow_up_on_reply_sent';
```

**Fix**:
- Verify Reply Agent is working
- Check trigger was created correctly
- Manually test trigger function:
  ```sql
  SELECT create_follow_up_sequence();
  ```

### Issue 2: Follow-ups Not Appearing in View

**Symptom**: `follow_ups_ready_to_send` returns empty

**Diagnosis**:
```sql
-- Check raw follow-ups table
SELECT
  id,
  follow_up_attempt,
  status,
  next_follow_up_date,
  next_follow_up_date <= NOW() as is_ready
FROM prospect_follow_ups;
```

**Possible Causes**:
- `status` is not 'pending' (check: 'sent', 'cancelled', 'paused')
- `next_follow_up_date` is in the future
- `follow_up_attempt` exceeds `max_attempts`

**Fix**:
```sql
-- Reset for testing
UPDATE prospect_follow_ups
SET
  status = 'pending',
  next_follow_up_date = NOW() - INTERVAL '1 minute'
WHERE id = 'your-follow-up-id';
```

### Issue 3: AI Generation Failing

**Symptom**: Error "Follow-up generation failed"

**Diagnosis**:
```bash
# Check OpenRouter API key
echo $OPENROUTER_API_KEY

# Check API endpoint logs
# Netlify Functions → /api/follow-ups/generate → Logs
```

**Common Errors**:
- Missing `OPENROUTER_API_KEY`
- Invalid context structure
- OpenRouter API rate limit

**Fix**:
- Verify environment variable set
- Check request structure matches `FollowUpContext` interface
- Monitor OpenRouter usage dashboard

### Issue 4: Messages Not Sending

**Symptom**: Follow-ups queued but not delivered

**Diagnosis**:
```sql
-- Check message outbox
SELECT
  status,
  channel,
  failure_reason,
  created_at
FROM message_outbox
WHERE metadata->>'message_type' = 'follow_up'
ORDER BY created_at DESC
LIMIT 10;
```

**Possible Causes**:
- Message outbox processor not running
- Unipile account disconnected
- Invalid prospect email/LinkedIn URL

**Fix**:
- Verify existing message sender workflow is active
- Check Unipile account status
- Validate prospect contact info

### Issue 5: Too Many Follow-ups Sent

**Symptom**: Prospects receiving more than 3 follow-ups

**Diagnosis**:
```sql
-- Check follow-up counts
SELECT
  prospect_id,
  COUNT(*) as follow_up_count,
  MAX(follow_up_attempt) as max_attempt
FROM prospect_follow_ups
WHERE status = 'sent'
GROUP BY prospect_id
HAVING COUNT(*) > 3;
```

**Fix**:
```sql
-- Mark as completed
UPDATE prospect_follow_ups
SET status = 'completed'
WHERE prospect_id = 'over-followed-prospect-id';
```

---

## Performance Benchmarks

### Timing

- **N8N Poll Interval**: 60 seconds
- **AI Generation Time**: ~2-4 seconds per follow-up
- **Queue Time**: < 100ms
- **Total Processing**: ~5-10 seconds per follow-up

### Throughput

- **Max Follow-ups per Minute**: ~10 (limited by N8N batch size)
- **Recommended**: 5-10 follow-ups per poll
- **Wait Between Sends**: 30 seconds (prevents rate limiting)

### Costs

- **OpenRouter (Claude 3.5 Sonnet)**:
  - Input: ~400 tokens @ $3/1M = $0.0012
  - Output: ~150 tokens @ $15/1M = $0.00225
  - **Total per follow-up**: ~$0.0035

- **Database**: Negligible (< $0.01/month)
- **N8N**: Included in existing plan
- **Unipile**: Uses existing account credits

**Cost per 1000 follow-ups**: ~$3.50

---

## Future Enhancements

### Planned Features

1. **Workspace-Level Configuration**
   - Custom timing intervals
   - Custom templates
   - Toggle enrichment on/off

2. **A/B Testing**
   - Test different tones
   - Measure conversion rates
   - Auto-optimize

3. **Smart Scheduling**
   - Detect prospect timezone
   - Send at optimal times
   - Avoid holidays

4. **Enriched Follow-ups**
   - Re-scrape company website
   - Check LinkedIn for new posts
   - Reference recent activity

5. **Analytics Dashboard**
   - Follow-up → Reply conversion
   - Best performing tones
   - Timing optimization insights

---

## Summary

The Follow-up Agent is now **production-ready** and will automatically:

✅ Create follow-up sequences when Reply Agent sends messages
✅ Generate AI-powered follow-ups with varying tones
✅ Queue messages for delivery via existing infrastructure
✅ Cancel sequences when prospects reply
✅ Respect business hours and timing rules
✅ Work for all workspaces with data isolation

**Next Steps**:
1. Monitor first week of follow-ups
2. Review conversion metrics
3. Adjust timing/tone based on results
4. Consider workspace-level customization

---

**Documentation Version**: 1.0
**Last Updated**: October 30, 2025
**Maintained By**: SAM AI Engineering Team
