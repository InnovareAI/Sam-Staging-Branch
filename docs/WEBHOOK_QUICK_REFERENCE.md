# Unipile Webhooks - Quick Reference

## Available Webhooks (Unipile Official)

### 1. Connection Acceptance: `new_relation`
**Source:** `users`
**Event Type:** `new_relation`
**When:** LinkedIn user accepts your connection request
**Latency:** Up to 8 hours

**Payload:**
```json
{
  "event": "new_relation",
  "account_id": "unipile_account_id",
  "account_type": "LINKEDIN",
  "webhook_name": "my-webhook",
  "user": {
    "full_name": "John Doe",
    "provider_id": "ACoAA1234567890",
    "public_identifier": "john-doe",
    "profile_url": "https://linkedin.com/in/john-doe/",
    "picture_url": "https://..."
  }
}
```

**Our Implementation:** `/api/webhooks/unipile-connection-accepted`

---

### 2. Message Received: `message_received`
**Source:** `chats`
**Event Type:** `message_received`
**When:** Prospect replies to your message
**Latency:** Real-time

**Payload:**
```json
{
  "event": "message_received",
  "account_id": "unipile_account_id",
  "account_type": "LINKEDIN",
  "webhook_name": "my-webhook",
  "message": {
    "id": "msg_abc123",
    "content": "Thanks for the connection!",
    "timestamp": "2025-11-22T16:00:00Z",
    "subject": null
  },
  "chat": {
    "id": "chat_xyz789",
    "subject": "Chat with John Doe"
  },
  "sender": {
    "provider_id": "ACoAA1234567890",
    "full_name": "John Doe",
    "profile_url": "https://linkedin.com/in/john-doe/"
  },
  "attendees": [
    {
      "provider_id": "ACoAA1234567890",
      "full_name": "John Doe",
      "profile_url": "https://linkedin.com/in/john-doe/",
      "type": "user"
    }
  ]
}
```

**To Implement:** `/api/webhooks/unipile-message-received` (N8N integration)

---

### 3. Message Delivered: `message_delivered`
**Source:** `chats`
**Event Type:** `message_delivered`
**When:** Your message was delivered
**Latency:** Real-time

**Payload:**
```json
{
  "event": "message_delivered",
  "account_id": "unipile_account_id",
  "message_id": "msg_abc123",
  "timestamp": "2025-11-22T16:00:00Z"
}
```

---

### 4. Message Read: `message_read`
**Source:** `chats`
**Event Type:** `message_read`
**When:** Recipient read your message
**Latency:** Real-time

**Payload:**
```json
{
  "event": "message_read",
  "account_id": "unipile_account_id",
  "message_id": "msg_abc123",
  "reader": {
    "provider_id": "ACoAA1234567890",
    "full_name": "John Doe"
  },
  "timestamp": "2025-11-22T16:00:00Z"
}
```

---

### 5. Message Reaction: `message_reaction`
**Source:** `chats`
**Event Type:** `message_reaction`
**When:** Recipient reacted with emoji
**Latency:** Real-time

**Payload:**
```json
{
  "event": "message_reaction",
  "account_id": "unipile_account_id",
  "message_id": "msg_abc123",
  "reaction": "👍",
  "reactor": {
    "provider_id": "ACoAA1234567890",
    "full_name": "John Doe"
  },
  "timestamp": "2025-11-22T16:00:00Z"
}
```

---

## Registration API

### Create Webhook
```bash
curl -X POST https://api6.unipile.com:13670/api/v1/webhooks \
  -H "X-API-KEY: ${UNIPILE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
    "url": "https://app.meet-sam.com/api/webhooks/unipile-connection-accepted",
    "source": "users",
    "event_type": "new_relation",
    "active": true
  }'
```

### List Webhooks
```bash
curl -X GET https://api6.unipile.com:13670/api/v1/webhooks \
  -H "X-API-KEY: ${UNIPILE_API_KEY}"
```

### Delete Webhook
```bash
curl -X DELETE https://api6.unipile.com:13670/api/v1/webhooks/{webhook_id} \
  -H "X-API-KEY: ${UNIPILE_API_KEY}"
```

---

## Our Implementation Plan

| Webhook | Purpose | Status | Priority |
|---------|---------|--------|----------|
| `new_relation` | Detect CR acceptance | ✅ Implemented | P0 |
| `/users/relations` polling | Backup acceptance detection | ✅ Implemented | P0 |
| `message_received` | Handle replies | ⏳ TODO | P1 |
| `message_delivered` | Track delivery | ⏳ TODO | P2 |
| `message_read` | Track engagement | ⏳ TODO | P2 |
| `message_reaction` | Track reactions | ⏳ TODO | P3 |

---

## Handler Response Requirements

**Unipile expects:**
- HTTP 200 OK within 30 seconds
- Do not block on processing
- Queue heavy work asynchronously

**Example:**
```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Queue async processing (don't wait)
  processWebhookAsync(body).catch(console.error);

  // Return immediately
  return NextResponse.json({ received: true });
}

async function processWebhookAsync(body: any) {
  // Heavy lifting here
  // Update database
  // Trigger N8N
  // etc.
}
```

---

## Webhook Validation

**Recommended:** Add custom header authentication

**In webhook registration:**
```json
{
  "url": "https://app.meet-sam.com/api/webhooks/...",
  "headers": {
    "X-Webhook-Secret": "your-secret-token"
  }
}
```

**In handler:**
```typescript
const secret = req.headers.get('x-webhook-secret');
if (secret !== process.env.WEBHOOK_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## Key Facts

✅ **Unipile DOES have built-in webhooks** - No external service needed
✅ **Multiple event types available** - Relations, messages, delivery, reads, reactions
✅ **Real-time delivery** - Most events arrive immediately
✅ **Exception: CR acceptance** - 8-hour latency (LinkedIn limitation)
✅ **Retry logic** - Unipile retries failed deliveries automatically
✅ **Per-account configuration** - Different webhooks per Unipile account

---

**Last Updated:** November 22, 2025
**Source:** Unipile Official Documentation
