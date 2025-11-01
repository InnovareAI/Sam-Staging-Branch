# N8N Enrichment - Quick Fix for Header Auth Error

**Issue:** N8N Supabase nodes can't use dynamic credentials from webhook payload.

**Solution:** Use HTTP Request nodes with direct Supabase REST API calls instead.

---

## 🔧 Quick Fix: Use HTTP Request Nodes

Since N8N's Supabase nodes don't support dynamic credentials, we'll use **HTTP Request nodes** to call Supabase REST API directly.

### Option 1: Replace Supabase Nodes (Recommended)

**For each Supabase node in the workflow:**

1. **Delete the Supabase node**
2. **Add HTTP Request node** instead
3. **Configure as shown below**

---

### HTTP Request Node Examples

#### 1. Mark Job as Processing

**Replace:** "Mark Job as Processing" Supabase node

**With:** HTTP Request node

```json
{
  "name": "Mark Job as Processing",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "PATCH",
    "url": "={{ $json.supabase_url }}/rest/v1/enrichment_jobs?id=eq.{{ $json.job_id }}",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "={{ $json.supabase_key }}"
        },
        {
          "name": "Authorization",
          "value": "=Bearer {{ $json.supabase_key }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        },
        {
          "name": "Prefer",
          "value": "return=minimal"
        }
      ]
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "status",
          "value": "processing"
        },
        {
          "name": "started_at",
          "value": "={{ new Date().toISOString() }}"
        }
      ]
    }
  }
}
```

#### 2. Get Prospects to Enrich

```json
{
  "name": "Get Prospects to Enrich",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "GET",
    "url": "={{ $json.supabase_url }}/rest/v1/workspace_prospects?select=id,linkedin_url,company_name,location,industry&id=in.({{ $json.prospect_ids.join(',') }})",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "={{ $('Parse Job Data').item.json.supabase_key }}"
        },
        {
          "name": "Authorization",
          "value": "=Bearer {{ $('Parse Job Data').item.json.supabase_key }}"
        }
      ]
    }
  }
}
```

#### 3. Update Prospect with Enriched Data

```json
{
  "name": "Update Prospect with Enriched Data",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "PATCH",
    "url": "={{ $('Parse Job Data').item.json.supabase_url }}/rest/v1/workspace_prospects?id=eq.{{ $json.prospect_id }}",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "={{ $('Parse Job Data').item.json.supabase_key }}"
        },
        {
          "name": "Authorization",
          "value": "=Bearer {{ $('Parse Job Data').item.json.supabase_key }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        },
        {
          "name": "Prefer",
          "value": "return=minimal"
        }
      ]
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        {
          "name": "company_name",
          "value": "={{ $json.company_name }}"
        },
        {
          "name": "location",
          "value": "={{ $json.location }}"
        },
        {
          "name": "industry",
          "value": "={{ $json.industry }}"
        }
      ]
    }
  }
}
```

---

## Option 2: Simpler - Use Pre-configured Credential

Instead of passing credentials in webhook, configure ONE Supabase credential in N8N and use it for all nodes.

### Step 1: Remove Dynamic Credentials from Workflow

In each Supabase node, **remove** the `credentials` block:

```json
// DELETE THIS from all nodes:
"credentials": {
  "supabaseApi": {
    "url": "={{ $json.supabase_url }}",
    "serviceRole": "={{ $json.supabase_key }}"
  }
}
```

### Step 2: Create Fixed Credential in N8N

1. Go to N8N → Settings → Credentials
2. Create new "Supabase" credential:
   - **Name**: Sam Supabase Service Role
   - **Host**: `latxadqrvrrrcvkktrog.supabase.co`
   - **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ`
3. Save credential

### Step 3: Apply to All Supabase Nodes

For each of these 7 nodes, select the credential you just created:
1. Mark Job as Processing
2. Get Prospects to Enrich
3. Update Current Prospect Progress
4. Update Prospect with Enriched Data
5. Increment Processed Count
6. Increment Failed Count
7. Mark Job Complete

### Step 4: Remove Credentials from Webhook Payload

Update `app/api/prospects/enrich-async/route.ts` to NOT send credentials:

```typescript
// Remove these from the webhook payload:
// supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
// supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,

// Keep only these:
body: JSON.stringify({
  job_id: job.id,
  workspace_id: workspaceId,
  prospect_ids: finalProspectIds,
  brightdata_api_token: process.env.BRIGHTDATA_API_TOKEN,
  brightdata_zone: process.env.BRIGHTDATA_ZONE
})
```

---

## ✅ Recommended Approach: Option 2 (Pre-configured Credential)

**Why:**
- ✅ Simpler - uses N8N's built-in credential system
- ✅ More secure - credentials stored encrypted in N8N
- ✅ No code changes needed
- ✅ Standard N8N pattern

**Steps:**
1. Edit workflow in N8N
2. Remove ALL `credentials` blocks from Supabase nodes
3. Create one Supabase credential in N8N Settings
4. Apply credential to all 7 Supabase nodes
5. Save and activate workflow

---

## 🧪 Test After Fix

```bash
# Run test script
node scripts/js/test-n8n-enrichment.mjs
```

**Expected:**
- ✅ No "header auth is missing" error
- ✅ Job progresses from pending → processing → completed
- ✅ Prospect data enriched in database

---

## 📞 If Still Issues

**Check N8N Execution Logs:**
1. Go to: https://innovareai.app.n8n.cloud/executions
2. Find latest execution
3. Click each node to see error details

**Common Issues:**
- Missing credential on a node → Apply credential to ALL 7 Supabase nodes
- Wrong credential → Verify service role key is correct
- RLS error → Ensure using service_role key (not anon key)

---

**Status:** 🔧 Apply fix and retry
