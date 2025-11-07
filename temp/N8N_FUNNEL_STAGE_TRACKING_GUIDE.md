# N8N Funnel Stage Tracking Integration Guide

## Overview

To get all funnel stages tracked in the SAM database, the N8N workflow needs to send status updates to the new prospect status webhook after each stage.

## Webhook Endpoint

**URL**: `https://app.meet-sam.com/api/campaigns/webhook/prospect-status`
**Method**: `POST`
**Authentication**: `Bearer {N8N_WEBHOOK_SECRET_TOKEN}`

## Funnel Stages to Track

```
1. connection_requested     - After sending connection request
2. connection_accepted      - After connection is accepted (hourly check)
3. acceptance_message_sent  - After sending acceptance message
4. fu1_sent                 - After sending follow-up 1
5. fu2_sent                 - After sending follow-up 2
6. fu3_sent                 - After sending follow-up 3
7. fu4_sent                 - After sending follow-up 4
8. gb_sent                  - After sending Give & Get (final message)
9. replied                  - When prospect replies
10. connection_rejected     - If connection request is rejected
11. failed                  - If any step fails
```

## N8N Workflow Integration

### Step 1: Add HTTP Request Node After Each Stage

For EACH funnel stage, add an HTTP Request node:

**Node Name**: `Update Prospect Status - {STAGE_NAME}`

**Configuration**:
- Method: `POST`
- URL: `https://app.meet-sam.com/api/campaigns/webhook/prospect-status`
- Authentication: `Header Auth`
  - Name: `Authorization`
  - Value: `Bearer {{$env.N8N_WEBHOOK_SECRET_TOKEN}}`

**JSON Body**:
```json
{
  "prospect_id": "{{ $json.prospect_id }}",
  "campaign_id": "{{ $json.campaign_id }}",
  "status": "connection_requested",
  "message_id": "{{ $json.unipile_message_id }}",
  "message_content": "{{ $json.message_sent }}",
  "sent_at": "{{ $now.toISO() }}",
  "metadata": {
    "n8n_execution_id": "{{ $execution.id }}",
    "workflow_id": "{{ $workflow.id }}"
  }
}
```

### Step 2: Example Node Placement

```
[Loop Over Prospects]
    ↓
[Fetch LinkedIn Profile] (GET /api/v1/users/{username})
    ↓
[Send Connection Request] (POST /api/v1/users/invite)
    ↓
[Update Status: connection_requested] ← NEW HTTP REQUEST NODE
    ↓
[Wait 1 Hour]
    ↓
[Check Connection Status Loop]
    ↓
[IF: Connection Accepted]
    ↓
[Update Status: connection_accepted] ← NEW HTTP REQUEST NODE
    ↓
[Wait 4 Hours]
    ↓
[Send Acceptance Message] (POST /api/v1/messages)
    ↓
[Update Status: acceptance_message_sent] ← NEW HTTP REQUEST NODE
    ↓
[Wait 5 Days]
    ↓
[Send Follow-Up 1] (POST /api/v1/messages)
    ↓
[Update Status: fu1_sent] ← NEW HTTP REQUEST NODE
    ↓
[Continue pattern for FU2, FU3, FU4, GB...]
```

### Step 3: Handle Connection Rejection

```
[Check Connection Status Loop]
    ↓
[IF: Connection Rejected]
    ↓
[Update Status: connection_rejected] ← NEW HTTP REQUEST NODE
    ↓
[End Funnel for This Prospect]
```

### Step 4: Handle Failures

Wrap critical nodes in error handling:

```
[Try to Send Message]
    ↓
[On Error]
    ↓
[Update Status: failed] ← NEW HTTP REQUEST NODE
{
  "status": "failed",
  "error_message": "{{ $json.error_message }}",
  "metadata": {
    "failed_at_step": "send_fu1"
  }
}
```

### Step 5: Handle Replies

Add a webhook listener or polling node:

```
[Check for Replies] (Polling every hour)
    ↓
[IF: New Reply Found]
    ↓
[Update Status: replied] ← NEW HTTP REQUEST NODE
    ↓
[Trigger HITL Approval]
```

## Status Update Payload Examples

### 1. Connection Requested
```json
{
  "prospect_id": "123e4567-e89b-12d3-a456-426614174000",
  "campaign_id": "987fcdeb-51d3-a456-e89b-426614174111",
  "status": "connection_requested",
  "message_id": "msg_abc123",
  "sent_at": "2025-11-07T10:30:00Z"
}
```

### 2. Connection Accepted
```json
{
  "prospect_id": "123e4567-e89b-12d3-a456-426614174000",
  "campaign_id": "987fcdeb-51d3-a456-e89b-426614174111",
  "status": "connection_accepted",
  "sent_at": "2025-11-08T15:45:00Z"
}
```

### 3. Acceptance Message Sent
```json
{
  "prospect_id": "123e4567-e89b-12d3-a456-426614174000",
  "campaign_id": "987fcdeb-51d3-a456-e89b-426614174111",
  "status": "acceptance_message_sent",
  "message_id": "msg_def456",
  "message_content": "Hi {{first_name}}, thanks for connecting!",
  "sent_at": "2025-11-08T19:45:00Z"
}
```

### 4. Follow-Up Sent
```json
{
  "prospect_id": "123e4567-e89b-12d3-a456-426614174000",
  "campaign_id": "987fcdeb-51d3-a456-e89b-426614174111",
  "status": "fu1_sent",
  "message_id": "msg_ghi789",
  "message_content": "Following up on my previous message...",
  "sent_at": "2025-11-13T09:00:00Z"
}
```

### 5. Failed
```json
{
  "prospect_id": "123e4567-e89b-12d3-a456-426614174000",
  "campaign_id": "987fcdeb-51d3-a456-e89b-426614174111",
  "status": "failed",
  "error_message": "LinkedIn account rate limit exceeded",
  "metadata": {
    "failed_at_step": "send_fu2",
    "error_code": "RATE_LIMIT_EXCEEDED"
  }
}
```

## Testing the Webhook

You can test the webhook with curl:

```bash
curl -X POST https://app.meet-sam.com/api/campaigns/webhook/prospect-status \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prospect_id": "VALID_PROSPECT_ID",
    "campaign_id": "VALID_CAMPAIGN_ID",
    "status": "connection_requested",
    "message_id": "test_msg_123",
    "sent_at": "2025-11-07T10:00:00Z"
  }'
```

## Verifying Status Updates

After deploying the updated workflow, verify status tracking with:

```sql
-- Check status distribution
SELECT status, COUNT(*)
FROM campaign_prospects
GROUP BY status
ORDER BY COUNT(*) DESC;

-- Check funnel tracking in personalization_data
SELECT
  id,
  first_name,
  last_name,
  status,
  personalization_data->'funnel_tracking'
FROM campaign_prospects
WHERE personalization_data->'funnel_tracking' IS NOT NULL
LIMIT 10;
```

## Environment Variables Required

Make sure these are set in N8N:

```bash
N8N_WEBHOOK_SECRET_TOKEN=your-secret-token-here
SAM_WEBHOOK_URL=https://app.meet-sam.com/api/campaigns/webhook/prospect-status
```

## Next Steps

1. ✅ Deploy the new webhook endpoint to production
2. ⏳ Update N8N Master Campaign workflow with status update nodes
3. ⏳ Test with a single prospect end-to-end
4. ⏳ Monitor database to verify all stages are being tracked
5. ⏳ Update SAM UI to display funnel stage visualization
