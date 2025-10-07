# N8N Reply Agent Integration

**Purpose**: N8N workflow to send HITL-approved replies to prospects
**Date**: October 7, 2025
**Status**: Specification (Needs Implementation)

---

## System Architecture

### Message Flow Overview

```
HITL approves reply (via email)
  ↓
SAM webhook queues to message_outbox
  ↓
N8N polls message_outbox (every 10 seconds)
  ↓
N8N determines sending provider based on workspace tier
  ↓
N8N sends via Unipile (or ReachInbox for initial campaigns)
  ↓
N8N updates message_outbox status
  ↓
Message delivered to prospect
```

### Provider Routing

**Startup Tier** (low volume):
- Email: N8N → Unipile (1 email account)
- LinkedIn: N8N → Unipile

**SME/Enterprise Tier** (high volume):
- Initial campaigns: N8N → ReachInbox (bulk)
- Replies: N8N → Unipile (same account receiving replies)
- LinkedIn: N8N → Unipile

**HITL Messaging** (all tiers):
- Always: Postmark (separate from campaigns)

---

## N8N Workflow Specification

### Workflow Name
`Reply Agent - HITL Approved Message Sender`

### Trigger
**Polling Trigger** (every 10 seconds):
- Query `message_outbox` table
- Filter: `status = 'queued'` AND `scheduled_send_time <= NOW()`
- Order by: `scheduled_send_time ASC`
- Limit: 10 messages per poll

### Workflow Steps

#### 1. Fetch Queued Messages

**Node**: Supabase Query
```sql
SELECT
  mo.id,
  mo.workspace_id,
  mo.campaign_id,
  mo.prospect_id,
  mo.reply_id,
  mo.channel,
  mo.message_content,
  mo.metadata,
  w.tier_name,
  cr.sender_email,
  cr.sender_name,
  cr.platform
FROM message_outbox mo
JOIN workspaces w ON mo.workspace_id = w.id
LEFT JOIN campaign_replies cr ON mo.reply_id = cr.id
WHERE mo.status = 'queued'
  AND mo.scheduled_send_time <= NOW()
ORDER BY mo.scheduled_send_time ASC
LIMIT 10;
```

#### 2. Update Status to 'sending'

**Node**: Supabase Update
```sql
UPDATE message_outbox
SET status = 'sending',
    updated_at = NOW()
WHERE id = {{$json.id}};
```

#### 3. Route by Channel

**Node**: Switch
- **Case 1**: `channel = 'email'` → Go to Email Sender
- **Case 2**: `channel = 'linkedin'` → Go to LinkedIn Sender
- **Default**: Mark as failed (invalid channel)

---

### Email Sending (via Unipile)

#### 4a. Get Unipile Account ID

**Node**: Supabase Query
```sql
SELECT unipile_account_id
FROM workspace_email_accounts
WHERE workspace_id = {{$json.workspace_id}}
  AND is_active = true
LIMIT 1;
```

#### 4b. Send Email via Unipile API

**Node**: HTTP Request

**Method**: `POST`
**URL**: `https://api.unipile.com/api/v1/messages`
**Headers**:
```json
{
  "X-API-KEY": "{{$env.UNIPILE_API_KEY}}",
  "Content-Type": "application/json"
}
```

**Body**:
```json
{
  "account_id": "{{$json.unipile_account_id}}",
  "provider": "GMAIL" or "OUTLOOK",
  "to": [
    {
      "email": "{{$json.metadata.prospect_email}}",
      "name": "{{$json.sender_name}}"
    }
  ],
  "subject": "Re: {{$json.campaign_name}}",
  "body": {
    "html": "{{$json.message_content.replace(/\n/g, '<br>')}}",
    "text": "{{$json.message_content}}"
  },
  "reply_to": "{{$json.metadata.prospect_email}}"
}
```

**Response**: Store `message_id` from Unipile

#### 4c. Update Outbox - Success

**Node**: Supabase Update
```sql
UPDATE message_outbox
SET status = 'sent',
    sent_at = NOW(),
    external_message_id = {{$json.message_id}},
    n8n_execution_id = {{$execution.id}},
    updated_at = NOW()
WHERE id = {{$json.id}};
```

#### 4d. Update Outbox - Failure

**Node**: Supabase Update (Error Handler)
```sql
UPDATE message_outbox
SET status = 'failed',
    failed_at = NOW(),
    failure_reason = {{$json.error.message}},
    n8n_execution_id = {{$execution.id}},
    updated_at = NOW()
WHERE id = {{$json.id}};
```

---

### LinkedIn Sending (via Unipile)

#### 5a. Get Unipile LinkedIn Account

**Node**: Supabase Query
```sql
SELECT unipile_account_id
FROM workspace_linkedin_accounts
WHERE workspace_id = {{$json.workspace_id}}
  AND is_active = true
LIMIT 1;
```

#### 5b. Send LinkedIn Message via Unipile

**Node**: HTTP Request

**Method**: `POST`
**URL**: `https://api.unipile.com/api/v1/messages`
**Headers**:
```json
{
  "X-API-KEY": "{{$env.UNIPILE_API_KEY}}",
  "Content-Type": "application/json"
}
```

**Body**:
```json
{
  "account_id": "{{$json.unipile_account_id}}",
  "provider": "LINKEDIN",
  "recipients": [
    {
      "linkedin_id": "{{$json.metadata.prospect_linkedin}}"
    }
  ],
  "text": "{{$json.message_content}}"
}
```

#### 5c. Update Outbox (same as email success/failure)

---

## Database Schema

### message_outbox Table

```sql
id UUID PRIMARY KEY
workspace_id UUID REFERENCES workspaces(id)
campaign_id UUID REFERENCES campaigns(id)
prospect_id UUID
reply_id UUID REFERENCES campaign_replies(id)

-- Message details
channel TEXT -- 'email', 'linkedin', 'both'
message_content TEXT
subject TEXT

-- Status tracking
status TEXT -- 'queued', 'sending', 'sent', 'failed', 'cancelled'
scheduled_send_time TIMESTAMPTZ
sent_at TIMESTAMPTZ
failed_at TIMESTAMPTZ
failure_reason TEXT

-- External IDs
external_message_id TEXT -- Unipile message ID
n8n_execution_id TEXT -- N8N workflow execution ID

-- Metadata
metadata JSONB
  {
    "created_via": "reply_agent_email",
    "prospect_email": "john@company.com",
    "prospect_linkedin": "john-smith-123",
    "created_at": "2025-10-07T..."
  }

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### Status Flow

```
queued → sending → sent
              ↓
           failed
```

---

## Error Handling

### Retry Logic

**Failed sends should retry**:
- Update `status` back to 'queued'
- Increment `metadata.retry_count`
- Set `scheduled_send_time` = NOW() + (retry_count * 5 minutes)
- Max retries: 3

**After 3 failures**:
- Set `status` = 'failed'
- Notify workspace admin via email

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Account not found` | Unipile account disconnected | Notify user to reconnect |
| `Rate limit exceeded` | Too many messages | Backoff and retry |
| `Invalid recipient` | Bad email/LinkedIn ID | Mark as failed permanently |
| `Authentication failed` | Unipile API key expired | Alert admin |

---

## Monitoring & Alerts

### Metrics to Track

1. **Send Success Rate**
   - Target: >95%
   - Alert if: <90% over 1 hour

2. **Average Send Time**
   - Target: <30 seconds from queue
   - Alert if: >2 minutes

3. **Failed Messages**
   - Alert if: >5 failures in 10 minutes

4. **Queue Depth**
   - Alert if: >100 queued messages

### Dashboard Queries

**Messages sent last hour**:
```sql
SELECT COUNT(*) as sent_count
FROM message_outbox
WHERE sent_at > NOW() - INTERVAL '1 hour';
```

**Failed messages today**:
```sql
SELECT COUNT(*) as failed_count
FROM message_outbox
WHERE failed_at::date = CURRENT_DATE;
```

**Current queue depth**:
```sql
SELECT COUNT(*) as queued_count
FROM message_outbox
WHERE status = 'queued';
```

---

## Testing

### Test Workflow

**1. Create test message in outbox**:
```sql
INSERT INTO message_outbox (
  workspace_id,
  campaign_id,
  channel,
  message_content,
  status,
  scheduled_send_time,
  metadata
) VALUES (
  '{{workspace_id}}',
  '{{campaign_id}}',
  'email',
  'This is a test message from SAM Reply Agent.',
  'queued',
  NOW(),
  '{"created_via": "manual_test", "prospect_email": "test@example.com"}'::jsonb
);
```

**2. Verify N8N picks it up**:
- Check N8N executions within 10 seconds
- Verify status changes: queued → sending → sent

**3. Check Unipile**:
- Verify message appears in Unipile sent messages
- Confirm recipient received email

**4. Verify database update**:
```sql
SELECT * FROM message_outbox
WHERE id = '{{test_message_id}}';
```

Expected:
- `status` = 'sent'
- `sent_at` populated
- `external_message_id` from Unipile

---

## N8N Workflow JSON Template

```json
{
  "name": "Reply Agent - HITL Approved Sender",
  "nodes": [
    {
      "name": "Poll Outbox",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT mo.*, w.tier_name, cr.sender_email FROM message_outbox mo...",
        "options": {}
      }
    },
    {
      "name": "Update to Sending",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "executeQuery",
        "query": "UPDATE message_outbox SET status='sending'..."
      }
    },
    {
      "name": "Route by Channel",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "rules": {
          "rules": [
            {"value": "email"},
            {"value": "linkedin"}
          ]
        }
      }
    },
    {
      "name": "Send via Unipile",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://api.unipile.com/api/v1/messages",
        "authentication": "headerAuth"
      }
    },
    {
      "name": "Update Success",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "executeQuery",
        "query": "UPDATE message_outbox SET status='sent', sent_at=NOW()..."
      }
    }
  ],
  "connections": {},
  "settings": {
    "executionOrder": "v1"
  }
}
```

---

## Implementation Checklist

### Setup
- [ ] Create N8N workflow
- [ ] Configure Supabase connection
- [ ] Add Unipile API credentials
- [ ] Set up polling trigger (10 seconds)

### Testing
- [ ] Test email sending (Startup tier)
- [ ] Test LinkedIn sending
- [ ] Test error handling
- [ ] Test retry logic
- [ ] Verify status updates

### Monitoring
- [ ] Set up success rate alerts
- [ ] Set up queue depth alerts
- [ ] Create monitoring dashboard
- [ ] Configure failure notifications

### Documentation
- [ ] Document N8N workflow
- [ ] Create troubleshooting guide
- [ ] Document Unipile integration

---

## Next Steps

1. **Create N8N workflow** using template above
2. **Test with low-volume workspace** (Startup tier)
3. **Monitor for 24 hours** to verify reliability
4. **Scale to SME/Enterprise** tiers
5. **Set up monitoring** and alerts

---

**Created**: October 7, 2025
**Status**: Specification Ready
**Priority**: P1 (Required for complete HITL workflow)
**Estimated Time**: 4-6 hours for N8N setup + testing
