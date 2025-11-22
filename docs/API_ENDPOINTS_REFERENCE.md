# SAM AI Platform - Complete API Reference

**Last Updated**: November 22, 2025
**Total Endpoints**: 150+ across 15 feature categories
**Authentication**: Supabase JWT Token (all endpoints)

---

## Quick Reference

### Base URL
```
https://app.meet-sam.com/api
```

### Authentication
```bash
curl -H "Authorization: Bearer [supabase_jwt_token]" \
     -H "Content-Type: application/json" \
     https://app.meet-sam.com/api/campaigns
```

### Response Format
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

---

## 1. Campaign Management

### Create Campaign
```
POST /api/campaigns
```

**Request Body**:
```json
{
  "campaign_name": "Q4 Sales Outreach",
  "campaign_type": "connection_request",
  "linkedin_account_id": "uuid-of-account",
  "message_templates": {
    "connection_request": "Hi {first_name}, I'd like to connect!",
    "follow_up_1": "Following up on my earlier request...",
    "follow_up_2": "Checking in again...",
    "follow_up_3": "Last attempt to connect...",
    "follow_up_4": null,
    "follow_up_5": null,
    "goodbye_message": "All the best!"
  },
  "scheduled_at": "2025-12-01T09:00:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "campaign-uuid",
    "workspace_id": "workspace-uuid",
    "campaign_name": "Q4 Sales Outreach",
    "status": "draft"
  }
}
```

### List Campaigns
```
GET /api/campaigns?workspace_id=uuid&status=active&limit=50&offset=0
```

**Query Parameters**:
- `workspace_id` - Filter by workspace
- `status` - Filter: draft, active, paused, completed, archived
- `limit` - Results per page (default 50)
- `offset` - Pagination offset

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "campaign-uuid",
      "campaign_name": "Q4 Sales",
      "status": "active",
      "prospect_count": 150,
      "contacted_count": 45,
      "created_at": "2025-11-20T10:00:00Z"
    }
  ],
  "total": 12,
  "page": 0
}
```

### Get Campaign Details
```
GET /api/campaigns/[campaign_id]
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "campaign-uuid",
    "campaign_name": "Q4 Sales",
    "status": "active",
    "linkedin_account": {
      "id": "account-uuid",
      "account_name": "John Doe",
      "unipile_account_id": "unipile-id"
    },
    "message_templates": {
      "connection_request": "...",
      "follow_up_1": "..."
    },
    "prospects": [
      {
        "id": "prospect-uuid",
        "first_name": "Jane",
        "last_name": "Smith",
        "status": "connection_request_sent",
        "contacted_at": "2025-11-22T14:30:00Z"
      }
    ],
    "metrics": {
      "total_prospects": 150,
      "contacted": 45,
      "connected": 12,
      "replied": 3,
      "success_rate": 0.08
    },
    "created_at": "2025-11-20T10:00:00Z"
  }
}
```

### Update Campaign
```
PUT /api/campaigns/[campaign_id]
```

**Request Body**:
```json
{
  "campaign_name": "Q4 Sales Outreach - Updated",
  "message_templates": {
    "connection_request": "New message here..."
  }
}
```

### Delete Campaign
```
DELETE /api/campaigns/[campaign_id]
```

### Activate Campaign
```
POST /api/campaigns/activate
```

**Request Body**:
```json
{
  "campaign_id": "uuid",
  "start_immediately": true
}
```

**Effect**: Sets status to "active", triggers cron job to start processing prospects

### Pause Campaign
```
POST /api/campaigns/pause
```

**Request Body**:
```json
{
  "campaign_id": "uuid"
}
```

**Effect**: Pauses prospect processing, existing messages continue

### Clone Campaign
```
POST /api/campaigns/clone
```

**Request Body**:
```json
{
  "source_campaign_id": "uuid",
  "new_campaign_name": "Cloned Campaign"
}
```

### Schedule Campaign
```
POST /api/campaigns/schedule
```

**Request Body**:
```json
{
  "campaign_id": "uuid",
  "scheduled_start": "2025-12-01T09:00:00Z",
  "scheduled_end": "2025-12-15T17:00:00Z"
}
```

### Upload Prospects to Campaign
```
POST /api/campaigns/upload-prospects
```

**Request Body** (multipart/form-data):
- `file` - CSV file with columns: first_name, last_name, email, linkedin_url, company, title

**Response**:
```json
{
  "success": true,
  "data": {
    "session_id": "approval-session-uuid",
    "prospects_uploaded": 150,
    "approval_url": "https://app.meet-sam.com/approve/session-uuid"
  }
}
```

### Add Approved Prospects to Campaign
```
POST /api/campaigns/add-approved-prospects
```

**Request Body**:
```json
{
  "campaign_id": "uuid",
  "approval_session_id": "uuid",
  "prospect_ids": ["id1", "id2", "id3"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "added_count": 3,
    "duplicate_count": 0,
    "error_count": 0
  }
}
```

---

## 2. Prospect Management (Approval System)

### Get Approval Sessions
```
GET /api/prospect-approval/sessions/list?workspace_id=uuid
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "session-uuid",
      "campaign_name": "Q4 Sales",
      "total_prospects": 150,
      "pending_count": 120,
      "approved_count": 30,
      "rejected_count": 0,
      "status": "active",
      "created_at": "2025-11-20T10:00:00Z"
    }
  ]
}
```

### Get Prospects for Approval
```
GET /api/prospect-approval/prospects?session_id=uuid&limit=20
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "prospect-uuid",
      "session_id": "session-uuid",
      "name": "Jane Smith",
      "title": "VP Sales",
      "company": "Tech Corp",
      "linkedin_url": "https://www.linkedin.com/in/janesmith",
      "location": "San Francisco, CA",
      "enrichment_score": 85,
      "approval_status": "pending"
    }
  ],
  "total": 120,
  "page": 0
}
```

### Approve Single Prospect
```
POST /api/prospect-approval/decide
```

**Request Body**:
```json
{
  "prospect_id": "uuid",
  "session_id": "uuid",
  "decision": "approved",
  "notes": "Good fit for our target market"
}
```

### Bulk Approve Prospects
```
POST /api/prospect-approval/bulk-approve
```

**Request Body**:
```json
{
  "session_id": "uuid",
  "prospect_ids": ["id1", "id2", "id3", "..."],
  "notes": "Batch approval"
}
```

### Reject Prospect
```
POST /api/prospect-approval/decide
```

**Request Body**:
```json
{
  "prospect_id": "uuid",
  "session_id": "uuid",
  "decision": "rejected",
  "notes": "Outside target market"
}
```

### Get Approved Prospects
```
GET /api/prospect-approval/approved?session_id=uuid
```

**Response**:
```json
{
  "success": true,
  "data": {
    "approved_prospects": [
      {
        "id": "prospect-uuid",
        "name": "Jane Smith",
        "decision_date": "2025-11-21T10:00:00Z"
      }
    ],
    "total_approved": 45
  }
}
```

---

## 3. LinkedIn Integration

### Search LinkedIn
```
POST /api/linkedin/search/direct
```

**Request Body**:
```json
{
  "workspace_id": "uuid",
  "search_criteria": {
    "keywords": "VP Sales",
    "title": "VP of Sales",
    "company": "Tech",
    "location": "San Francisco",
    "years_of_experience_min": 5
  },
  "limit": 50,
  "save_to_approval": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "prospects": [
      {
        "name": "Jane Smith",
        "first_name": "Jane",
        "last_name": "Smith",
        "title": "VP of Sales",
        "company": "Tech Corp",
        "linkedin_url": "https://www.linkedin.com/in/janesmith",
        "provider_id": "ACoAABiau-UBgtBn...",
        "location": "San Francisco, CA",
        "headline": "VP Sales | 10+ years in tech"
      }
    ],
    "count": 50,
    "session_id": "approval-session-uuid",
    "message": "Found 50 prospects and saved to approval system"
  }
}
```

### Get LinkedIn Accounts
```
GET /api/linkedin/accounts?workspace_id=uuid
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "account-uuid",
      "account_name": "John Doe",
      "unipile_account_id": "unipile-id",
      "status": "connected",
      "rate_limit_remaining": 95,
      "rate_limit_reset_at": "2025-11-23T00:00:00Z",
      "created_at": "2025-11-15T10:00:00Z"
    }
  ]
}
```

### Get LinkedIn Profile
```
GET /api/linkedin/profiles/[linkedin_url]?account_id=uuid
```

**Query Parameters**:
- `account_id` - Which LinkedIn account to use
- `linkedin_url` - URL-encoded LinkedIn URL

**Response**:
```json
{
  "success": true,
  "data": {
    "provider_id": "ACoAABiau-UBgtBn...",
    "name": "Jane Smith",
    "title": "VP of Sales",
    "company": "Tech Corp",
    "headline": "VP Sales | 10+ years",
    "network_distance": "SECOND_DEGREE",
    "location": "San Francisco, CA",
    "invitation": {
      "status": "NONE",
      "sent_at": null,
      "withdrawn_at": null
    }
  }
}
```

### Check Invitation Status
```
GET /api/linkedin/profiles/[linkedin_url]/invitation?account_id=uuid
```

**Response**:
```json
{
  "status": "NONE" | "PENDING" | "ACCEPTED" | "WITHDRAWN",
  "sent_at": "2025-11-20T10:00:00Z",
  "withdrawn_at": null
}
```

### LinkedIn Commenting Campaigns
```
POST /api/linkedin-commenting/monitors
```

**Request Body**:
```json
{
  "campaign_name": "Tech Industry Comments",
  "hashtags": ["#SalesTech", "#B2B", "#LinkedInSales"],
  "keywords": ["sales automation", "lead generation"],
  "profiles": ["linkedin.com/in/john-doe", "linkedin.com/in/jane-smith"]
}
```

---

## 4. Message Management

### Send Campaign Message
```
POST /api/messages/send-campaign
```

**Request Body**:
```json
{
  "campaign_id": "uuid",
  "prospect_id": "uuid",
  "message_type": "connection_request" | "follow_up_1" | "follow_up_5" | "goodbye",
  "personalized_message": "Hi Jane, I'd like to connect and explore sales automation..."
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message_id": "msg-uuid",
    "sent_at": "2025-11-22T14:30:00Z",
    "status": "sent"
  }
}
```

### Get Conversation History
```
GET /api/messages/conversation/[prospect_id]?campaign_id=uuid&limit=50
```

**Response**:
```json
{
  "success": true,
  "data": {
    "conversation_id": "conv-uuid",
    "prospect": {
      "id": "prospect-uuid",
      "name": "Jane Smith",
      "email": "jane@techcorp.com",
      "linkedin_url": "https://www.linkedin.com/in/janesmith"
    },
    "messages": [
      {
        "id": "msg-uuid",
        "role": "outbound",
        "content": "Hi Jane, I'd like to connect...",
        "type": "connection_request",
        "sent_at": "2025-11-20T10:00:00Z",
        "status": "delivered"
      },
      {
        "id": "msg-uuid-2",
        "role": "inbound",
        "content": "Thanks for reaching out!",
        "type": "direct_message",
        "received_at": "2025-11-21T15:30:00Z",
        "status": "received"
      }
    ]
  }
}
```

### Generate Reply Draft
```
POST /api/sam/messages/draft-reply
```

**Request Body**:
```json
{
  "conversation_id": "uuid",
  "message_id": "uuid",
  "context": {
    "prospect_name": "Jane Smith",
    "company": "Tech Corp",
    "title": "VP Sales"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "draft_id": "draft-uuid",
    "drafts": [
      {
        "id": "draft-option-1",
        "content": "Hi Jane, thanks for getting back to me! I'd love to learn more about your sales process..."
      },
      {
        "id": "draft-option-2",
        "content": "Jane, appreciate you taking the time to respond. I believe there's real synergy here..."
      },
      {
        "id": "draft-option-3",
        "content": "Thanks for the quick response! Let me share a few use cases relevant to Tech Corp..."
      }
    ]
  }
}
```

### Approve & Send Reply
```
POST /api/messages/send-reply
```

**Request Body**:
```json
{
  "draft_id": "uuid",
  "selected_draft_id": "draft-option-2",
  "final_message": "Jane, appreciate you taking the time to respond. I believe there's real synergy here...",
  "conversation_id": "uuid"
}
```

---

## 5. SAM AI Features

### Create Conversation Thread
```
POST /api/sam/threads
```

**Request Body**:
```json
{
  "workspace_id": "uuid",
  "topic": "How to optimize LinkedIn outreach",
  "initial_message": "What are the best practices for connection request messages?"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "thread_id": "thread-uuid",
    "topic": "How to optimize LinkedIn outreach",
    "created_at": "2025-11-22T15:00:00Z"
  }
}
```

### Send Message to SAM
```
POST /api/sam/threads/[thread_id]/messages
```

**Request Body**:
```json
{
  "message": "What should I include in a connection request to a VP of Sales?",
  "context": {
    "industry": "B2B SaaS",
    "target_role": "VP Sales",
    "company_size": "50-500"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message_id": "msg-uuid",
    "response": "Based on best practices and your target audience (B2B SaaS VPs), here's what you should include:\n\n1. **Personalization** - Reference their recent activity or company news\n2. **Value Proposition** - Show how you can help with their challenges\n3. **Clear CTA** - Ask for a specific action (coffee chat, demo, etc.)\n\nExample message:\n'Hi [FirstName], I noticed your recent LinkedIn activity around sales automation. I work with B2B SaaS companies to improve their prospecting process. Would love to grab 15 minutes to discuss...'",
    "context_used": [
      {
        "title": "LinkedIn Connection Request Best Practices",
        "source": "knowledge_base"
      }
    ],
    "model": "claude-3.5-sonnet",
    "tokens_used": 342
  }
}
```

### Search Knowledge Base
```
POST /api/sam/knowledge/search
```

**Request Body**:
```json
{
  "query": "How do I handle objections from prospects?",
  "limit": 5,
  "similarity_threshold": 0.7
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "title": "Handling Common Sales Objections",
        "content": "The most common objections are: 1) 'I'm not interested'...",
        "category": "sales-techniques",
        "similarity_score": 0.95
      }
    ],
    "count": 1
  }
}
```

---

## 6. Admin & System

### Get System Health
```
GET /api/admin/health
```

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "checks": {
      "database": {
        "status": "connected",
        "response_time_ms": 45
      },
      "unipile": {
        "status": "connected",
        "last_request": "2025-11-22T15:30:00Z"
      },
      "n8n": {
        "status": "connected",
        "last_webhook": "2025-11-22T15:29:00Z"
      },
      "openrouter": {
        "status": "connected",
        "requests_today": 342
      }
    },
    "database_stats": {
      "campaigns_total": 45,
      "prospects_total": 8543,
      "messages_sent": 12430,
      "pending_prospects": 234
    }
  }
}
```

### Get Workspace Settings
```
GET /api/admin/settings?workspace_id=uuid
```

**Response**:
```json
{
  "success": true,
  "data": {
    "workspace_name": "Tech Sales Inc",
    "workspace_tier": "enterprise",
    "rate_limits": {
      "connection_requests_per_week": 500,
      "used_this_week": 245,
      "remaining": 255
    },
    "features_enabled": [
      "linkedin_campaigns",
      "email_campaigns",
      "linkedin_commenting",
      "sam_ai",
      "knowledge_base"
    ],
    "integrations": {
      "linkedin": { "status": "connected", "accounts": 2 },
      "email": { "status": "connected", "accounts": 1 },
      "n8n": { "status": "connected" }
    }
  }
}
```

### List Users in Workspace
```
GET /api/admin/users?workspace_id=uuid
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid",
      "email": "john@techsales.com",
      "name": "John Doe",
      "role": "owner",
      "status": "active",
      "created_at": "2025-01-15T10:00:00Z"
    },
    {
      "id": "user-uuid-2",
      "email": "jane@techsales.com",
      "name": "Jane Smith",
      "role": "admin",
      "status": "active",
      "created_at": "2025-02-20T10:00:00Z"
    }
  ]
}
```

### Invite User to Workspace
```
POST /api/admin/invite-user
```

**Request Body**:
```json
{
  "email": "newuser@techsales.com",
  "role": "member",
  "message": "Welcome to our sales team!"
}
```

---

## 7. Cron Jobs (Internal)

### Process Pending Prospects
```
POST /api/cron/process-pending-prospects
```

**Runs**: Every 5 minutes automatically

**Actions**:
1. Fetch pending prospects (status = "pending" or "approved")
2. For each prospect, fetch LinkedIn profile via Unipile
3. Check invitation status (NONE, PENDING, ACCEPTED, WITHDRAWN)
4. Send connection request if eligible
5. Update prospect status to "connection_request_sent"
6. Schedule follow-up for 3 days later

**Rate Limiting**: Process 10 prospects per run (tunable)

### Poll Accepted Connections
```
POST /api/cron/poll-accepted-connections
```

**Runs**: Every 30 minutes automatically

**Actions**:
1. Find prospects with status = "connection_request_sent"
2. Fetch profile for each via Unipile
3. Check if `network_distance` changed to "FIRST_DEGREE"
4. If accepted, update status to "connected"
5. Trigger first follow-up message

### Monitor Notifications
```
POST /api/cron/check-pending-notifications
```

**Runs**: Every 5 minutes automatically

**Actions**:
1. Check for new incoming messages via Unipile webhooks
2. Create notification tasks
3. Send approval emails for human review

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid campaign_id format",
  "code": "INVALID_REQUEST",
  "details": {
    "field": "campaign_id",
    "message": "UUID required"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required",
  "code": "UNAUTHORIZED",
  "details": {
    "message": "Invalid or missing JWT token"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Access denied",
  "code": "FORBIDDEN",
  "details": {
    "message": "You do not have access to this resource"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Resource not found",
  "code": "NOT_FOUND",
  "details": {
    "resource": "campaign",
    "id": "invalid-uuid"
  }
}
```

### 429 Rate Limited
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "details": {
    "retry_after": 60,
    "limit": 100,
    "window": "1 hour"
  }
}
```

### 500 Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "code": "INTERNAL_ERROR",
  "details": {
    "message": "An unexpected error occurred"
  }
}
```

---

## Rate Limits

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Search LinkedIn | 50 requests | 1 hour |
| Send Messages | 100 requests | 1 hour |
| Get Data | 1000 requests | 1 hour |
| Admin Operations | 50 requests | 1 hour |
| Webhook Receivers | Unlimited | N/A |

---

## Common Integration Examples

### Complete Campaign Creation Workflow
```bash
# 1. Create campaign
curl -X POST https://app.meet-sam.com/api/campaigns \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_name": "Q4 Outreach",
    "campaign_type": "connection_request",
    "linkedin_account_id": "uuid"
  }'

# 2. Search prospects
curl -X POST https://app.meet-sam.com/api/linkedin/search/direct \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "uuid",
    "search_criteria": {"title": "VP Sales"},
    "save_to_approval": true
  }'

# 3. Approve prospects
curl -X POST https://app.meet-sam.com/api/prospect-approval/bulk-approve \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "uuid",
    "prospect_ids": ["id1", "id2", "id3"]
  }'

# 4. Add to campaign
curl -X POST https://app.meet-sam.com/api/campaigns/add-approved-prospects \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "uuid",
    "approval_session_id": "uuid"
  }'

# 5. Activate campaign
curl -X POST https://app.meet-sam.com/api/campaigns/activate \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"campaign_id": "uuid"}'
```

---

**For additional details, see**: `COMPLETE_ARCHITECTURE_GUIDE.md`
