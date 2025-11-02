# 🔴 N8N Workflow Configuration Required

**Status:** Campaign execution is calling N8N but the workflow is failing

**Error:** "V1 Campaign Orchestration failed"

**Root Cause:** The N8N workflow at `https://innovareai.app.n8n.cloud` either doesn't exist, isn't active, or is misconfigured.

---

## ✅ What's Working

1. ✅ Sam UI triggers campaign execution
2. ✅ API route `/api/campaigns/linkedin/execute-via-n8n` is called
3. ✅ Webhook sends data to N8N: `https://innovareai.app.n8n.cloud/webhook/campaign-execute`
4. ✅ N8N responds with: `{"message":"Workflow was started"}`
5. ❌ **N8N workflow fails during execution**

---

## 🔧 N8N Workflow Required Configuration

### Workflow Name
`LinkedIn Campaign Execution`

### Webhook Path
`/webhook/campaign-execute`

### Required Nodes

```
1. Webhook (Trigger)
   ├─ Method: POST
   ├─ Path: campaign-execute
   └─ Response Mode: On Received

2. Set Variables
   ├─ campaign_id: {{ $json.campaign_id }}
   ├─ workspace_id: {{ $json.workspace_id }}
   ├─ prospects: {{ $json.campaign_data.prospects }}
   └─ message_template: {{ $json.campaign_data.message_templates.connection_request }}

3. Loop Over Prospects (Split In Batches)
   ├─ Batch Size: 1
   └─ Input: {{ $json.campaign_data.prospects }}

4. Get LinkedIn Account (HTTP Request)
   ├─ Method: GET
   ├─ URL: https://{{ $env.UNIPILE_DSN }}/api/v1/accounts
   ├─ Headers:
   │   ├─ X-API-KEY: {{ $env.UNIPILE_API_KEY }}
   │   └─ Accept: application/json
   └─ Filter for account_type=linkedin, status=active

5. Personalize Message (Code Node)
   ├─ Replace {first_name} with prospect.first_name
   ├─ Replace {company_name} with prospect.company
   └─ Replace {industry} with prospect.industry

6. Send LinkedIn Connection Request (HTTP Request)
   ├─ Method: POST
   ├─ URL: https://{{ $env.UNIPILE_DSN }}/api/v1/users/invite
   ├─ Headers:
   │   ├─ X-API-KEY: {{ $env.UNIPILE_API_KEY }}
   │   ├─ Accept: application/json
   │   └─ Content-Type: application/json
   ├─ Body:
   │   {
   │     "account_id": "{{ $node['Get LinkedIn Account'].json.id }}",
   │     "linkedin_url": "{{ $json.linkedin_url }}",
   │     "message": "{{ $node['Personalize Message'].json.personalizedMessage }}"
   │   }
   └─ Error Workflow: Continue on fail

7. Update Prospect Status (HTTP Request)
   ├─ Method: POST
   ├─ URL: https://app.meet-sam.com/api/campaigns/update-contacted
   ├─ Headers:
   │   └─ Content-Type: application/json
   ├─ Body:
   │   {
   │     "campaignId": "{{ $json.campaign_id }}",
   │     "prospectId": "{{ $json.id }}",
   │     "status": "connection_requested",
   │     "unipileMessageId": "{{ $node['Send LinkedIn Connection Request'].json.id }}"
   │   }
   └─ Continue on fail

8. Wait (Optional - for rate limiting)
   └─ Duration: 30 seconds

9. Response (Webhook Response)
   ├─ Status Code: 200
   └─ Body: { "success": true, "processed": {{ $json.total }} }
```

---

## 🔑 Required Environment Variables in N8N

Set these in N8N Settings → Environment Variables:

```
UNIPILE_DSN=your-unipile-instance.unipile.com
UNIPILE_API_KEY=your_unipile_api_key
SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

---

## 📋 Incoming Webhook Data Structure

The N8N workflow receives this payload:

```json
{
  "campaign_id": "uuid",
  "workspace_id": "uuid",
  "workspace_tier": "startup",
  "workspace_config": {
    "tier_limits": { ... },
    "integration_config": {
      "unipile_instance_url": "...",
      "linkedin_accounts": [ ... ],
      "email_accounts": [ ... ]
    }
  },
  "campaign_type": "connector",
  "campaign_data": {
    "name": "Campaign Name",
    "message_templates": {
      "connection_request": "Hi {first_name}, ...",
      "follow_up_messages": [ ... ]
    },
    "prospects": [
      {
        "id": "uuid",
        "first_name": "Alex",
        "last_name": "TestUser",
        "company": "Test Company A",
        "job_title": "CEO",
        "linkedin_url": "https://linkedin.com/in/alextest",
        "email": "alex@example.com"
      }
    ]
  },
  "execution_preferences": {
    "hitl_approval_required": true,
    "batch_size": 20,
    "execution_pace": "moderate"
  },
  "hitl_config": {
    "approval_method": "email",
    "approver_email": "user@example.com"
  }
}
```

---

## 🧪 Testing the Workflow

### Test 1: Webhook Receives Data

```bash
curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "test",
    "workspace_id": "test",
    "campaign_data": {
      "prospects": [{"first_name": "Test"}]
    }
  }'
```

Expected: 200 OK response

### Test 2: Check N8N Executions

1. Go to: https://innovareai.app.n8n.cloud/executions
2. Find the most recent execution
3. All nodes should be green (success)
4. If any node is red, click it to see the error

### Test 3: Verify LinkedIn Message Sent

1. Go to: https://linkedin.com/mynetwork/invitation-manager/sent/
2. Look for the connection request to the test prospect
3. Verify the message matches the template

---

## 🐛 Common Issues

### Issue 1: "Cannot find property 'prospects'"

**Cause:** Webhook data structure doesn't match what nodes expect

**Fix:** Update node expressions to match actual webhook structure:
- Use `{{ $json.campaign_data.prospects }}` not `{{ $json.prospects }}`

### Issue 2: "Unipile API unauthorized"

**Cause:** Missing or incorrect UNIPILE_API_KEY

**Fix:**
1. Go to N8N Settings → Variables
2. Add `UNIPILE_API_KEY` with correct value
3. Restart workflow

### Issue 3: "No LinkedIn account found"

**Cause:** No active LinkedIn account in workspace

**Fix:**
1. Go to Sam UI → Workspace Settings → Integrations
2. Connect a LinkedIn account via Unipile
3. Verify `workspace_accounts` table has the account

---

## ✅ Success Checklist

Before testing in production:

- [ ] N8N workflow exists with name "LinkedIn Campaign Execution"
- [ ] Webhook path is `/webhook/campaign-execute`
- [ ] All 9 nodes are configured correctly
- [ ] Environment variables are set (UNIPILE_DSN, UNIPILE_API_KEY)
- [ ] Workflow is **activated** (toggle in top-right)
- [ ] Test execution succeeds (all nodes green)
- [ ] LinkedIn connection request appears in LinkedIn
- [ ] Prospect status updates to "connection_requested" in database

---

## 📞 Next Steps

1. **Access N8N Dashboard:**
   - URL: https://innovareai.app.n8n.cloud
   - Login with your credentials

2. **Check if workflow exists:**
   - Click "Workflows" in sidebar
   - Search for "campaign" or "linkedin"

3. **If workflow doesn't exist:**
   - Create new workflow
   - Follow the node configuration above
   - Activate the workflow

4. **Test the workflow:**
   - Run a test campaign from Sam UI
   - Check N8N executions for errors
   - Fix any configuration issues

5. **Report back:**
   - Share which node is failing
   - Share the error message
   - We'll fix the configuration together

---

**Created:** November 2, 2025
**Status:** ⚠️ Awaiting N8N workflow configuration
**Priority:** HIGH - Blocking all campaign execution
