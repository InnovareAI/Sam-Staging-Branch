# N8N Multi-Tenant Workflow Architecture
**Date:** October 7, 2025
**Status:** Architecture Design

---

## 🏗️ System Architecture

### **Core Principle:**
One hosted N8N instance (`workflows.innovareai.com`) serves **ALL workspaces** across all tenants.

### **Architecture Layers:**

```
┌─────────────────────────────────────────────────────────────┐
│                    SAM AI Platform                          │
│  (app.meet-sam.com, sendingcell.com, 3cubed.ai, etc.)     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Campaign Launch API
                  │ POST /api/campaign/execute-n8n
                  │
┌─────────────────▼───────────────────────────────────────────┐
│            Hosted N8N Instance                              │
│         https://workflows.innovareai.com                    │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │         Master Campaign Workflow                   │    │
│  │  - Handles all workspace campaigns                 │    │
│  │  - Routes by workspace_id                         │    │
│  │  - Dynamic message sequences                       │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │         Common Template Workflows                  │    │
│  │                                                     │    │
│  │  1. CR + 4FU + 1GB (Connection Request Standard)   │    │
│  │  2. Email 5-Touch Sequence                        │    │
│  │  3. InMail + Follow-up                            │    │
│  │  4. Multi-Channel (LinkedIn + Email)              │    │
│  └───────────────────────────────────────────────────┘    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Unipile API
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                  Unipile Integration                        │
│  - LinkedIn messaging via connected accounts                │
│  - Email sending via connected accounts                     │
│  - Multi-account routing                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Standard Workflow Template: CR + 4FU + 1GB

### **Workflow Name:** `SAM LinkedIn Connection Request + 4 Follow-ups + Goodbye`

### **Sequence:**

1. **CR (Connection Request)** - Day 0
   - Send LinkedIn connection request
   - Include personalized message (150 chars max)
   - Wait for acceptance

2. **FU1 (Follow-up 1)** - Day 2 after connection
   - Thank for connecting
   - Introduce value proposition
   - Open-ended question

3. **FU2 (Follow-up 2)** - Day 5 after FU1
   - Share relevant resource/insight
   - Reference their industry/role
   - Soft CTA

4. **FU3 (Follow-up 3)** - Day 7 after FU2
   - Case study or success story
   - Direct value demonstration
   - Meeting request

5. **FU4 (Follow-up 4)** - Day 5 after FU3
   - Final value offer
   - Urgency/scarcity element
   - Clear CTA

6. **GB (Goodbye)** - Day 7 after FU4
   - Graceful exit if no response
   - Leave door open
   - Unsubscribe option

### **Total Duration:** ~26 days

---

## 🔧 Workflow Configuration

### **Master Workflow Parameters:**

```json
{
  "workflow_id": "master-campaign-orchestrator",
  "workspace_id": "{{workspace_id}}",
  "campaign_id": "{{campaign_id}}",
  "template": "cr_4fu_1gb",
  "linkedin_account_id": "{{linkedin_account_id}}",
  "prospects": [
    {
      "prospect_id": "{{prospect_id}}",
      "first_name": "{{first_name}}",
      "last_name": "{{last_name}}",
      "linkedin_url": "{{linkedin_url}}",
      "company": "{{company}}",
      "title": "{{title}}"
    }
  ],
  "messages": {
    "cr": "{{connection_request_message}}",
    "fu1": "{{follow_up_1_message}}",
    "fu2": "{{follow_up_2_message}}",
    "fu3": "{{follow_up_3_message}}",
    "fu4": "{{follow_up_4_message}}",
    "gb": "{{goodbye_message}}"
  },
  "timing": {
    "fu1_delay_days": 2,
    "fu2_delay_days": 5,
    "fu3_delay_days": 7,
    "fu4_delay_days": 5,
    "gb_delay_days": 7
  },
  "options": {
    "stop_on_reply": true,
    "skip_weekends": true,
    "active_hours_only": true,
    "timezone": "{{workspace_timezone}}"
  }
}
```

### **N8N Workflow Nodes:**

1. **Webhook Trigger**
   - URL: `https://workflows.innovareai.com/webhook/campaign-execute`
   - Method: POST
   - Authentication: API Key header

2. **Workspace Router**
   - Switch node based on `workspace_id`
   - Routes to correct tenant configuration

3. **Template Selector**
   - Switch node based on `template` parameter
   - Default: `cr_4fu_1gb`

4. **Connection Request Node**
   - Unipile API: Send connection request
   - Store prospect status: `connection_pending`

5. **Wait for Connection (Webhook)**
   - Listen for connection acceptance
   - Timeout: 14 days
   - If accepted: continue to FU1
   - If rejected/timeout: mark as failed

6. **Follow-up 1-4 Nodes** (repeated pattern)
   - Wait X days from previous message
   - Check if prospect replied (stop if yes)
   - Send message via Unipile
   - Update prospect status

7. **Goodbye Node**
   - Final message
   - Mark campaign complete for prospect
   - Update stats

8. **Error Handler**
   - Retry logic (3 attempts)
   - Notification to workspace admin
   - Log to database

---

## 🔐 Multi-Tenant Isolation

### **Workspace Separation:**

Each campaign execution includes:
- `workspace_id` - Tenant identifier
- `campaign_id` - Campaign identifier
- `user_id` - User who created campaign
- `linkedin_account_id` - Specific LinkedIn account for this workspace

### **Database Schema:**

```sql
-- Campaign executions per workspace
CREATE TABLE workspace_campaign_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  n8n_execution_id TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT NOT NULL, -- running, completed, failed, cancelled
  prospects_total INT NOT NULL,
  prospects_completed INT DEFAULT 0,
  prospects_failed INT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prospect message tracking
CREATE TABLE prospect_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  prospect_id UUID NOT NULL REFERENCES workspace_prospects(id),
  message_type TEXT NOT NULL, -- cr, fu1, fu2, fu3, fu4, gb
  message_content TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  reply_content TEXT,
  status TEXT NOT NULL, -- pending, sent, delivered, read, replied, failed
  unipile_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prospect_messages_workspace ON prospect_messages(workspace_id);
CREATE INDEX idx_prospect_messages_campaign ON prospect_messages(campaign_id);
CREATE INDEX idx_prospect_messages_prospect ON prospect_messages(prospect_id);
```

---

## 📊 Workflow Templates

### **Template 1: CR + 4FU + 1GB** (Standard)
- **Use case:** Cold outreach, B2B sales
- **Duration:** 26 days
- **Messages:** 6 total
- **Best for:** Building relationships, consultative sales

### **Template 2: CR + 2FU** (Short)
- **Use case:** Event invitations, quick outreach
- **Duration:** 9 days
- **Messages:** 3 total
- **Best for:** Time-sensitive offers, events

### **Template 3: CR + 7FU + 1GB** (Extended)
- **Use case:** High-value enterprise sales
- **Duration:** 45 days
- **Messages:** 9 total
- **Best for:** Complex sales cycles, enterprise deals

### **Template 4: Email 5-Touch**
- **Use case:** Email-only campaigns
- **Duration:** 21 days
- **Messages:** 5 total
- **Best for:** Webinar invites, content distribution

### **Template 5: Multi-Channel (LinkedIn + Email)**
- **Use case:** Maximum reach, omnichannel
- **Duration:** 30 days
- **Messages:** 8 total (4 LinkedIn, 4 Email)
- **Best for:** High-priority prospects, account-based marketing

---

## 🚀 Implementation Steps

### **Phase 1: Master Workflow Setup**
1. Create master N8N workflow
2. Configure workspace routing
3. Test with single workspace
4. Deploy to production

### **Phase 2: Template Library**
1. Build CR + 4FU + 1GB template
2. Create message variable system
3. Test timing and delivery
4. Add error handling

### **Phase 3: SAM Integration**
1. Connect SAM `create_campaign` MCP tool to N8N
2. Enable campaign launch via SAM
3. Add campaign monitoring
4. Create status webhooks

### **Phase 4: Multi-Tenant Rollout**
1. Deploy to all workspaces
2. Monitor performance
3. Collect feedback
4. Optimize templates

---

## 🔍 Monitoring & Analytics

### **Per-Workspace Metrics:**
- Campaigns running
- Messages sent/day
- Response rates
- Connection acceptance rates
- Error rates

### **System-Wide Metrics:**
- Total campaigns active
- N8N workflow health
- Unipile API usage
- Rate limit monitoring

### **Alerts:**
- Campaign failures
- Rate limit warnings
- Unipile API errors
- Workspace quota exceeded

---

## 📝 Next Steps

1. ✅ Design architecture (this document)
2. ⏳ Create master N8N workflow
3. ⏳ Build CR + 4FU + 1GB template
4. ⏳ Test with InnovareAI workspace
5. ⏳ Deploy to production
6. ⏳ Roll out to all workspaces

---

**Last Updated:** October 7, 2025
**Status:** Design Complete - Ready for Implementation
