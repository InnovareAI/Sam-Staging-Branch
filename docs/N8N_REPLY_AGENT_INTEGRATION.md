# N8N Reply Agent Integration

**Purpose**: N8N workflow to send HITL-approved replies to prospects
**Date**: October 7, 2025 (Specification) | October 30, 2025 (Implementation)
**Status**: ✅ Implemented - Ready for Deployment

---

## 🎉 Implementation Complete

The Reply Agent N8N workflow has been implemented and is ready for deployment!

**Implemented Files**:
- ✅ `/n8n-workflows/reply-agent-hitl-sender.json` - Complete N8N workflow
- ✅ `/scripts/js/deploy-reply-agent-workflow.mjs` - Automated deployment script
- ✅ `/scripts/js/test-reply-agent-workflow.mjs` - Workflow validation tests

**Test Results**: All validation tests passed ✅

**Next Step**: Deploy to N8N instance using deployment script

---

## 🚀 Deployment Guide

### Prerequisites

Before deploying, ensure you have:

1. **N8N Instance Access**
   - N8N instance running at `https://workflows.innovareai.com`
   - N8N API key with workflow create/update permissions
   - Set in `.env`: `N8N_API_KEY=your_api_key`

2. **Database Access**
   - Supabase PostgreSQL credentials
   - Connection details for N8N Postgres nodes
   - Tables created: `message_outbox`, `campaign_replies`, `workspace_accounts`

3. **Unipile Integration**
   - Unipile DSN (domain)
   - Unipile API key
   - At least one connected workspace account (email or LinkedIn)

### Step 1: Validate Workflow

Run the validation tests to ensure the workflow is properly structured:

```bash
node scripts/js/test-reply-agent-workflow.mjs
```

Expected output:
```
✅ All tests passed!
📋 Workflow is ready for deployment
```

If any tests fail, check the workflow JSON file and fix issues before proceeding.

### Step 2: Deploy to N8N

Deploy the workflow using the automated deployment script:

```bash
node scripts/js/deploy-reply-agent-workflow.mjs
```

This script will:
- Check if workflow already exists (by name)
- Create new workflow OR update existing workflow
- Return workflow ID and configuration instructions

Expected output:
```
✅ Workflow created!
   ID: [workflow-id]

🔗 Workflow URL: https://workflows.innovareai.com/workflow/[workflow-id]
```

### Step 3: Configure N8N Credentials

1. **Open the workflow in N8N**:
   - Go to: `https://workflows.innovareai.com/workflow/[workflow-id]`
   - Click "Open workflow"

2. **Configure Supabase PostgreSQL Connection**:
   - Click on any Postgres node (e.g., "Fetch Queued Messages")
   - Click "Credential to connect with" dropdown
   - Select "Create New Credential"
   - Enter connection details:
     ```
     Name: Supabase PostgreSQL
     Host: latxadqrvrrrcvkktrog.supabase.co
     Database: postgres
     User: postgres
     Password: [your-supabase-password]
     Port: 5432
     SSL: Enabled (Required)
     ```
   - Click "Save"
   - Apply this credential to ALL Postgres nodes in the workflow:
     - Fetch Queued Messages
     - Update Status to Sending
     - Get Email Account
     - Get LinkedIn Account
     - Update Email Success
     - Update LinkedIn Success
     - Update Failure
     - Retry Failed Messages

3. **Configure Environment Variables**:
   - Go to: Settings → Variables
   - Add the following variables:
     ```
     UNIPILE_DSN: [your-unipile-dsn]
     UNIPILE_API_KEY: [your-unipile-api-key]
     ```
   - These are automatically used by the HTTP Request nodes

### Step 4: Test the Workflow

Before activating, test with a sample message:

1. **Insert test message into database**:
   ```sql
   INSERT INTO message_outbox (
     id,
     workspace_id,
     campaign_id,
     prospect_id,
     reply_id,
     channel,
     message_content,
     subject,
     status,
     scheduled_send_time,
     metadata
   ) VALUES (
     gen_random_uuid(),
     '[your-workspace-id]',
     '[your-campaign-id]',
     '[your-prospect-id]',
     '[your-reply-id]',
     'email',
     'This is a test reply message from SAM AI Reply Agent. If you receive this, the workflow is working correctly!',
     'Re: Test Reply',
     'queued',
     NOW(),
     jsonb_build_object(
       'prospect_email', '[your-email-address]',
       'test', true
     )
   );
   ```

2. **Run workflow manually in N8N**:
   - Click "Test workflow" button
   - Wait 10 seconds for polling trigger to execute
   - Check execution log for results

3. **Verify results**:
   - Check N8N execution log for success
   - Query database to verify status updated:
     ```sql
     SELECT id, status, sent_at, external_message_id, failure_reason
     FROM message_outbox
     WHERE metadata->>'test' = 'true'
     ORDER BY created_at DESC
     LIMIT 1;
     ```
   - Expected: `status = 'sent'`, `sent_at` populated, `external_message_id` from Unipile
   - Check your email inbox for the test message

### Step 5: Activate the Workflow

Once testing is successful:

1. Toggle the "Active" switch in N8N UI
2. Workflow will now poll every 10 seconds automatically
3. Monitor N8N executions tab for the first few minutes

### Step 6: Monitor & Verify

**Monitor N8N Executions**:
- Go to: Executions tab in N8N
- Look for executions of "Reply Agent - HITL Approved Message Sender"
- Verify successful executions (green checkmarks)
- If errors occur, click execution to see detailed logs

**Monitor Database**:
```sql
-- Check messages sent in last hour
SELECT
  status,
  channel,
  COUNT(*) as count,
  MAX(sent_at) as last_sent
FROM message_outbox
WHERE sent_at > NOW() - INTERVAL '1 hour'
GROUP BY status, channel;

-- Check for failed messages
SELECT
  id,
  channel,
  failure_reason,
  failed_at,
  metadata->>'retry_count' as retries
FROM message_outbox
WHERE status = 'failed'
  AND failed_at > NOW() - INTERVAL '24 hours'
ORDER BY failed_at DESC;
```

**Expected Performance**:
- Messages processed within 10 seconds of being queued
- Success rate: >95%
- No stuck messages in 'sending' status for >1 minute

### Troubleshooting

**Issue: Workflow not picking up messages**
- Verify workflow is Active (toggle should be ON)
- Check polling trigger is set to 10 seconds
- Verify database credentials are correct
- Check messages have `status = 'queued'` and `scheduled_send_time <= NOW()`

**Issue: Messages failing to send**
- Check Unipile credentials are correct (UNIPILE_DSN, UNIPILE_API_KEY)
- Verify workspace has active Unipile account connected
- Check Unipile account has not expired or been disconnected
- Review failure_reason in message_outbox table

**Issue: Database credential error**
- Verify Supabase credentials are correct
- Check SSL is enabled in Postgres credential
- Ensure all Postgres nodes use the same credential
- Test connection directly using psql: `psql -h latxadqrvrrrcvkktrog.supabase.co -U postgres -d postgres`

**Issue: Environment variables not found**
- Go to N8N Settings → Variables
- Verify UNIPILE_DSN and UNIPILE_API_KEY are set
- Check variable names match exactly (case-sensitive)
- Restart N8N workflow if variables were just added

### Deployment Checklist

Use this checklist to ensure complete deployment:

- [ ] Validate workflow JSON (run test script)
- [ ] Deploy workflow to N8N (run deployment script)
- [ ] Configure Supabase PostgreSQL credential in N8N
- [ ] Apply Supabase credential to all Postgres nodes
- [ ] Set UNIPILE_DSN environment variable
- [ ] Set UNIPILE_API_KEY environment variable
- [ ] Insert test message into message_outbox
- [ ] Run manual test execution in N8N
- [ ] Verify test message sent successfully
- [ ] Verify database status updated correctly
- [ ] Activate workflow (toggle Active switch)
- [ ] Monitor executions for 5-10 minutes
- [ ] Verify production messages sending correctly
- [ ] Set up monitoring alerts (optional but recommended)

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
- [x] Create N8N workflow - ✅ Complete
- [x] Create automated deployment script - ✅ Complete
- [x] Create workflow validation tests - ✅ Complete
- [ ] Configure Supabase connection - Requires N8N UI access
- [ ] Add Unipile API credentials - Requires N8N UI access
- [x] Set up polling trigger (10 seconds) - ✅ Complete

### Testing
- [x] Validate workflow structure - ✅ All tests passed
- [x] Validate SQL queries - ✅ All queries validated
- [x] Validate Unipile API configuration - ✅ Complete
- [x] Validate node connections - ✅ Complete
- [ ] Test email sending (Startup tier) - Requires deployment
- [ ] Test LinkedIn sending - Requires deployment
- [ ] Test error handling - Requires deployment
- [ ] Test retry logic - Requires deployment
- [ ] Verify status updates - Requires deployment

### Monitoring
- [ ] Set up success rate alerts
- [ ] Set up queue depth alerts
- [ ] Create monitoring dashboard
- [ ] Configure failure notifications

### Documentation
- [x] Document N8N workflow - ✅ Complete
- [x] Create deployment guide - ✅ Complete
- [x] Create troubleshooting guide - ✅ Complete
- [x] Document Unipile integration - ✅ Complete

---

## Next Steps

1. ✅ **Create N8N workflow** - COMPLETE
2. ✅ **Create deployment script** - COMPLETE
3. ✅ **Validate workflow structure** - COMPLETE
4. **Deploy to N8N** - Run `node scripts/js/deploy-reply-agent-workflow.mjs`
5. **Configure N8N credentials** - Follow deployment guide above
6. **Test with sample message** - Insert test message into message_outbox
7. **Monitor for 24 hours** to verify reliability
8. **Set up monitoring** and alerts

---

**Created**: October 7, 2025 (Specification)
**Implemented**: October 30, 2025
**Status**: ✅ Ready for Deployment
**Priority**: P1 (Required for complete HITL workflow)
**Files Created**:
- `/n8n-workflows/reply-agent-hitl-sender.json`
- `/scripts/js/deploy-reply-agent-workflow.mjs`
- `/scripts/js/test-reply-agent-workflow.mjs`
