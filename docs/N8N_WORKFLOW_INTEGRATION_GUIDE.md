# N8N Workflow Integration Guide

**Date:** October 7, 2025
**Status:** Implementation Complete
**Workflow ID:** `aVG6LC4ZFRMN7Bw6`

---

## 🎉 Master Workflow Created

The **SAM Master Campaign Orchestrator** workflow has been successfully deployed to N8N.

### Workflow Details

- **Name:** SAM Master Campaign Orchestrator
- **ID:** `aVG6LC4ZFRMN7Bw6`
- **Webhook URL:** `https://workflows.innovareai.com/webhook/campaign-execute`
- **Status:** Created (needs activation)
- **Created:** October 7, 2025

---

## 📊 Workflow Architecture

The master workflow implements the **CR + 4FU + 1GB** template:

### Message Sequence

1. **CR (Connection Request)** - Day 0
   - Sends LinkedIn connection request via Unipile API
   - Includes personalized message (150 chars max)

2. **FU1 (Follow-up 1)** - Day 2 after CR
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

**Total Duration:** 26 days

---

## 🚀 How to Activate the Workflow

### Step 1: Activate in N8N UI

1. Log in to N8N: https://workflows.innovareai.com
2. Navigate to **Workflows** → **SAM Master Campaign Orchestrator**
3. Click **Activate** button in the top right
4. Verify the webhook is active

### Step 2: Configure Environment Variables in N8N

The workflow requires these environment variables:

```bash
UNIPILE_API_URL=https://<your-dsn>.unipile.com/api/v1
UNIPILE_API_KEY=<your-unipile-api-key>
SAM_API_URL=https://app.meet-sam.com
```

Add these in N8N **Settings** → **Variables**

### Step 3: Test the Webhook

```bash
curl -X POST https://workflows.innovareai.com/webhook/campaign-execute \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "babdcab8-1a78-4b2f-913e-6e9fd9821009",
    "campaign_id": "test-campaign-123",
    "template": "cr_4fu_1gb",
    "linkedin_account_id": "nefy7jYjS5K6X3U7ORxHNQ",
    "prospects": [
      {
        "id": "test-prospect-1",
        "first_name": "John",
        "last_name": "Doe",
        "linkedin_url": "https://linkedin.com/in/johndoe",
        "company_name": "Acme Corp",
        "title": "CEO"
      }
    ],
    "messages": {
      "cr": "Hi {{first_name}}, I'\''d love to connect!",
      "fu1": "Thanks for connecting, {{first_name}}!",
      "fu2": "I wanted to share this resource with you...",
      "fu3": "Here'\''s a case study that might interest you...",
      "fu4": "Last chance to grab this offer!",
      "gb": "No worries if timing isn'\''t right. Best wishes!"
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
      "timezone": "America/New_York"
    }
  }'
```

---

## 🔗 Integration with SAM AI

### Campaign Execution Flow

```
SAM AI (User creates campaign)
    ↓
POST /api/campaign/execute-n8n
    ↓
N8N Master Workflow (aVG6LC4ZFRMN7Bw6)
    ↓
Unipile API (sends LinkedIn messages)
    ↓
POST /api/campaign/update-status (tracks progress)
```

### Required API Endpoint

Create this endpoint in SAM AI to trigger campaigns:

**File:** `/app/api/campaign/execute-n8n/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://workflows.innovareai.com/webhook/campaign-execute';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspace_id,
      campaign_id,
      template = 'cr_4fu_1gb',
      linkedin_account_id,
      prospects,
      messages,
      timing,
      options
    } = body;

    // Validate required fields
    if (!workspace_id || !campaign_id || !linkedin_account_id || !prospects || prospects.length === 0) {
      return NextResponse.json({
        error: 'Missing required fields: workspace_id, campaign_id, linkedin_account_id, prospects'
      }, { status: 400 });
    }

    // Send to N8N webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id,
        campaign_id,
        template,
        linkedin_account_id,
        prospects,
        messages,
        timing: timing || {
          fu1_delay_days: 2,
          fu2_delay_days: 5,
          fu3_delay_days: 7,
          fu4_delay_days: 5,
          gb_delay_days: 7
        },
        options: options || {
          stop_on_reply: true,
          skip_weekends: true,
          active_hours_only: true,
          timezone: 'America/New_York'
        }
      })
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      throw new Error(`N8N webhook failed: ${errorText}`);
    }

    const result = await n8nResponse.json();

    // Save execution to database
    const { data: execution } = await supabase
      .from('workspace_campaign_executions')
      .insert({
        workspace_id,
        campaign_id,
        n8n_execution_id: result.execution_id || 'unknown',
        template,
        status: 'running',
        prospects_total: prospects.length,
        prospects_completed: 0,
        prospects_failed: 0
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      execution_id: result.execution_id,
      campaign_execution: execution
    });

  } catch (error) {
    console.error('Campaign execution error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to execute campaign'
    }, { status: 500 });
  }
}
```

---

## 📋 Database Schema

The workflow requires these database tables (already defined in architecture doc):

### `workspace_campaign_executions`

Tracks campaign execution status per workspace.

```sql
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
```

### `prospect_messages`

Tracks individual messages sent to each prospect.

```sql
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

## 🔍 Monitoring & Debugging

### Check Workflow Executions

```bash
# List all N8N workflows
node scripts/js/list-n8n-workflows.mjs

# Check execution status
curl -X GET "https://workflows.innovareai.com/api/v1/executions/<execution_id>" \
  -H "X-N8N-API-KEY: <your-api-key>"
```

### View Campaign Status in Database

```sql
-- Check running campaigns
SELECT * FROM workspace_campaign_executions
WHERE status = 'running'
ORDER BY started_at DESC;

-- Check prospect messages
SELECT
  pm.*,
  wp.first_name,
  wp.last_name
FROM prospect_messages pm
JOIN workspace_prospects wp ON wp.id = pm.prospect_id
WHERE pm.campaign_id = '<campaign-id>'
ORDER BY pm.created_at DESC;
```

### Common Issues

**Issue:** Webhook returns 404
- **Solution:** Ensure workflow is activated in N8N UI

**Issue:** Messages not sending
- **Solution:** Check Unipile API credentials in N8N environment variables

**Issue:** Workflow timing not working
- **Solution:** Verify N8N wait nodes are configured correctly (days vs hours)

---

## 🎯 Next Steps

1. ✅ **Master workflow created** (ID: aVG6LC4ZFRMN7Bw6)
2. ⏳ **Activate workflow in N8N UI**
3. ⏳ **Configure Unipile credentials in N8N**
4. ⏳ **Create `/api/campaign/execute-n8n` endpoint in SAM**
5. ⏳ **Create database tables for tracking**
6. ⏳ **Test with single prospect**
7. ⏳ **Deploy to production**
8. ⏳ **Integrate with SAM campaign creation flow**

---

## 📚 Related Documentation

- **Architecture:** `/docs/N8N_MULTI_TENANT_WORKFLOW_ARCHITECTURE.md`
- **N8N Client:** `/lib/n8n/n8n-client.ts`
- **Unipile Integration:** `/lib/mcp/unipile-server.ts`

---

**Status:** Ready for activation and testing
**Last Updated:** October 7, 2025
