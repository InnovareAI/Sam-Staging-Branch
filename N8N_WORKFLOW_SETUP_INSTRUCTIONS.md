# N8N Workflow Setup Instructions
**Date:** November 1, 2025
**Workflow:** Campaign Execute - LinkedIn via Unipile
**Status:** Ready for manual import

---

## Problem Summary

**Issue:** Campaign prospects get queued to N8N but never execute.

**Root Cause:** N8N workflow exists (webhook responds 200 OK) but lacks Unipile integration steps to actually send LinkedIn invitations.

**Solution:** Import complete workflow with Unipile API integration and Supabase database updates.

---

## Quick Fix (5 Minutes)

### Step 1: Import Workflow

1. Go to: **https://innovareai.app.n8n.cloud**
2. Click: **Workflows** (left sidebar)
3. Click: **Add workflow** (top right)
4. Click: **⋯** (3-dot menu) → **Import from file**
5. Select file: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/n8n-workflows/campaign-execute.json`
6. Click: **Import**

### Step 2: Configure Environment Variables

1. In N8N, click: **Settings** (left sidebar)
2. Click: **Environment Variables**
3. Add the following variables:

| Variable Name | Value | Source |
|--------------|-------|--------|
| `UNIPILE_DSN` | `api6.unipile.com:13670` | From .env.local |
| `UNIPILE_API_KEY` | `TmJkVEMu.JYn0adim1VZVzIjkR0VzT...` | From .env.local |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://latxadqrvrrrcvkktrog.supabase.co` | From .env.local |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` | From .env.local |

**Get values from .env.local:**
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
grep "UNIPILE_DSN\|UNIPILE_API_KEY\|NEXT_PUBLIC_SUPABASE_URL\|SUPABASE_SERVICE_ROLE_KEY" .env.local
```

### Step 3: Activate Workflow

1. In the imported workflow editor
2. Click the **toggle switch** (top right) to activate
3. Verify: Switch shows **Active**
4. Click: **Save** (top right)

### Step 4: Test Campaign

1. Run a test campaign from the application:
   ```bash
   # Via application UI or API
   curl -X POST "https://app.meet-sam.com/api/campaigns/linkedin/execute-live" \
     -H "Content-Type: application/json" \
     -d '{"campaignId": "YOUR_CAMPAIGN_ID", "maxProspects": 1}'
   ```

2. Check N8N execution logs:
   - Go to: **Executions** (left sidebar in N8N)
   - Look for: Recent execution with "Campaign Execute"
   - Verify: All nodes show green checkmarks
   - Check: Logs show "✅ SUCCESS - Database updated for prospect"

3. Verify in database:
   ```sql
   SELECT id, first_name, last_name, status, contacted_at
   FROM campaign_prospects
   WHERE status = 'connection_requested'
     AND contacted_at > NOW() - INTERVAL '5 minutes'
   ORDER BY contacted_at DESC
   LIMIT 5;
   ```

---

## Workflow Architecture

### Workflow Nodes (9 Total)

```
1. Webhook (Trigger)
   ↓
2. Split Prospects (Code)
   ↓
3. Lookup LinkedIn Profile (HTTP Request → Unipile)
   ↓ (success)                ↓ (error)
4. Send LinkedIn Invitation   8. Error Handler (Code)
   (HTTP Request → Unipile)   ↓
   ↓ (success)                9. Update Failed Status
5. Extract Message ID            (HTTP Request → Supabase)
   (Code)
   ↓
6. Update Supabase
   (HTTP Request)
   ↓
7. Success (Code)
```

### Node Details

#### Node 1: Webhook
- **Type:** Webhook Trigger
- **Path:** `campaign-execute`
- **Method:** POST
- **Response:** "Workflow was started"
- **Purpose:** Receives campaign execution payload from API

**Payload Structure:**
```json
{
  "campaign_id": "uuid",
  "workspace_id": "uuid",
  "prospects": [
    {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "linkedin_url": "https://linkedin.com/in/johndoe"
    }
  ],
  "messages": {
    "cr": "Hi {{firstName}}, I'd like to connect..."
  },
  "campaign": {
    "name": "Test Campaign",
    "id": "uuid"
  }
}
```

#### Node 2: Split Prospects
- **Type:** Code (JavaScript)
- **Purpose:** Iterate through prospects array
- **Input:** Webhook payload with prospects array
- **Output:** One item per prospect

**Code:**
```javascript
const prospects = $input.item.json.prospects || [];
const campaign = $input.item.json.campaign || {};
const messages = $input.item.json.messages || {};

return prospects.map(prospect => ({
  json: { prospect, campaign, messages }
}));
```

#### Node 3: Lookup LinkedIn Profile
- **Type:** HTTP Request
- **Method:** GET
- **URL:** `https://{{$env.UNIPILE_DSN}}/api/v1/users/{{username}}`
- **Headers:** `X-API-KEY: {{$env.UNIPILE_API_KEY}}`
- **Purpose:** Get LinkedIn internal ID for prospect

**URL Extraction:**
```javascript
// Extracts "johndoe" from "https://linkedin.com/in/johndoe"
$json.prospect.linkedin_url.split('/in/')[1].split('?')[0]
```

**Response:**
```json
{
  "object": {
    "id": "linkedin_internal_id",
    "display_name": "John Doe",
    "profile_url": "https://linkedin.com/in/johndoe"
  }
}
```

#### Node 4: Send LinkedIn Invitation
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://{{$env.UNIPILE_DSN}}/api/v1/users/invite`
- **Headers:**
  - `X-API-KEY: {{$env.UNIPILE_API_KEY}}`
  - `Content-Type: application/json`
- **Body:**
```json
{
  "attendee_id": "{{$json.object.id}}",
  "text": "{{$json.messages.cr}}"
}
```

**Purpose:** Send connection request via Unipile/LinkedIn

**Response (expected):**
```json
{
  "object": {
    "id": "message_id_or_invitation_id"
  }
}
```

#### Node 5: Extract Message ID
- **Type:** Code (JavaScript)
- **Purpose:** Extract message ID from Unipile response
- **Handles:** Multiple possible response formats

**Code:**
```javascript
const unipileResponse = $input.item.json;
const prospect = $node["Lookup LinkedIn Profile"].json.prospect;

// Try multiple locations (Unipile API inconsistent)
const messageId =
  unipileResponse.object?.id ||
  unipileResponse.id ||
  unipileResponse.data?.id ||
  unipileResponse.message_id ||
  unipileResponse.invitation_id ||
  `untracked_${Date.now()}_${prospect.id}`;

return [{
  json: {
    prospect_id: prospect.id,
    message_id: messageId,
    status: 'connection_requested',
    contacted_at: new Date().toISOString(),
    unipile_response: JSON.stringify(unipileResponse)
  }
}];
```

#### Node 6: Update Supabase
- **Type:** HTTP Request
- **Method:** PATCH
- **URL:** `{{$env.NEXT_PUBLIC_SUPABASE_URL}}/rest/v1/campaign_prospects?id=eq.{{prospect_id}}`
- **Headers:**
  - `apikey: {{$env.SUPABASE_SERVICE_ROLE_KEY}}`
  - `Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}`
  - `Content-Type: application/json`
  - `Prefer: return=minimal`

**Body:**
```json
{
  "status": "connection_requested",
  "contacted_at": "2025-11-01T12:34:56.789Z",
  "personalization_data": {
    "unipile_message_id": "msg_abc123",
    "unipile_response": {...}
  }
}
```

**Purpose:** Update prospect status in database after successful send

#### Node 7: Success
- **Type:** Code (JavaScript)
- **Purpose:** Log success message

```javascript
console.log(`✅ SUCCESS - Database updated for prospect`);
return $input.all();
```

#### Node 8: Error Handler
- **Type:** Code (JavaScript)
- **Purpose:** Catch errors from Unipile or Supabase steps

```javascript
const error = $input.item.json.error || $input.item.json;
const prospect = $input.item.json.prospect || {};

console.error(`❌ Error processing prospect ${prospect.id}:`, error);

return [{
  json: {
    prospect_id: prospect.id,
    status: 'failed',
    error_message: error.message || JSON.stringify(error)
  }
}];
```

#### Node 9: Update Failed Status
- **Type:** HTTP Request
- **Method:** PATCH
- **URL:** Same as Node 6
- **Body:**
```json
{
  "status": "failed",
  "personalization_data": {
    "error": "{{error_message}}"
  }
}
```

**Purpose:** Update prospect status to 'failed' if any step errors

---

## Environment Variables Explained

### UNIPILE_DSN
- **Value:** `api6.unipile.com:13670`
- **Purpose:** Unipile API endpoint (host + port)
- **Used in:** Nodes 3, 4 (Unipile HTTP requests)
- **Format:** `{host}:{port}` (no https://)

### UNIPILE_API_KEY
- **Format:** JWT-like token starting with `TmJkVEMu.`
- **Purpose:** Authentication for Unipile API
- **Used in:** Nodes 3, 4 (X-API-KEY header)
- **Security:** Service role key - KEEP SECRET

### NEXT_PUBLIC_SUPABASE_URL
- **Value:** `https://latxadqrvrrrcvkktrog.supabase.co`
- **Purpose:** Supabase database API endpoint
- **Used in:** Nodes 6, 9 (database updates)
- **Format:** Full HTTPS URL

### SUPABASE_SERVICE_ROLE_KEY
- **Format:** JWT starting with `eyJhbGciOiJIUzI1NiIs`
- **Purpose:** Authentication for Supabase with bypass RLS
- **Used in:** Nodes 6, 9 (apikey + Authorization headers)
- **Security:** Service role key - BYPASSES RLS - KEEP SECRET

---

## Troubleshooting

### Issue: Workflow Not Executing

**Symptom:** Prospects stay in `queued_in_n8n` status

**Checks:**
1. Is workflow ACTIVE? (toggle switch in top right)
2. Are environment variables set correctly?
3. Check Executions tab for errors

**Fix:**
- Activate workflow if paused
- Re-import workflow if corrupted
- Check execution logs for specific error

### Issue: Unipile Authentication Errors

**Symptom:** Node 3 or 4 fails with 401/403

**Checks:**
1. Is `UNIPILE_API_KEY` set correctly?
2. Is LinkedIn account connected in Unipile?

**Fix:**
```bash
# Test Unipile connection
curl -X GET "https://api6.unipile.com:13670/api/v1/accounts" \
  -H "X-API-KEY: $UNIPILE_API_KEY"
```

### Issue: Supabase Update Fails

**Symptom:** Node 6 fails with 401 or 404

**Checks:**
1. Is `SUPABASE_SERVICE_ROLE_KEY` correct?
2. Does prospect ID exist in database?

**Fix:**
```sql
-- Verify prospect exists
SELECT id, first_name, last_name, status
FROM campaign_prospects
WHERE id = 'PROSPECT_ID';
```

### Issue: Message ID Always Using Fallback

**Symptom:** All prospects get `untracked_1234567890_uuid` format IDs

**Meaning:** Unipile not returning message ID in expected location

**Impact:**
- ✅ Messages still sending
- ⚠️ Cannot track message status in Unipile
- ⚠️ Follow-ups may not work

**Debug:**
1. Check N8N execution logs
2. Look at Node 4 output (Send Invitation response)
3. See what Unipile actually returns
4. Update Node 5 code if needed

### Issue: LinkedIn Invitations Not Appearing

**Symptom:** Workflow succeeds but no invitations on LinkedIn

**Checks:**
1. Log into LinkedIn manually
2. Go to: My Network → Manage → Sent
3. Look for recent invitations

**If missing:**
- LinkedIn account may be rate limited (100/week)
- Unipile may have returned success without actually sending
- LinkedIn session may have expired

**Fix:**
1. Reconnect LinkedIn in Unipile
2. Wait 24 hours if rate limited
3. Contact Unipile support

---

## Testing Checklist

After importing workflow:

- [ ] Workflow shows as **Active**
- [ ] All 4 environment variables set in N8N
- [ ] Webhook URL matches: `https://innovareai.app.n8n.cloud/webhook/campaign-execute`
- [ ] Test webhook responds 200 OK
- [ ] Run campaign with 1 test prospect
- [ ] Check Executions tab shows success
- [ ] Verify prospect status updated to `connection_requested`
- [ ] Verify `contacted_at` timestamp populated
- [ ] Check LinkedIn for sent invitation
- [ ] Review logs for any warnings/errors

---

## Webhook Test

```bash
# Test webhook manually
curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $N8N_API_KEY" \
  -d '{
    "campaign_id": "test-campaign",
    "workspace_id": "test-workspace",
    "prospects": [{
      "id": "test-prospect-id",
      "first_name": "Test",
      "last_name": "User",
      "linkedin_url": "https://linkedin.com/in/testuser"
    }],
    "messages": {
      "cr": "Hi Test, this is a test invitation."
    },
    "campaign": {
      "name": "Test Campaign"
    }
  }'
```

**Expected Response:**
```json
{"message": "Workflow was started"}
```

---

## Next Steps After Import

1. **Monitor First Campaign:**
   - Watch Executions tab in N8N
   - Check logs for errors
   - Verify LinkedIn invitations actually sent

2. **If Successful:**
   - Document any warnings/issues
   - Scale up to more prospects
   - Monitor for rate limits

3. **If Errors:**
   - Check execution logs for specific error
   - Verify environment variables correct
   - Test Unipile/Supabase connections manually
   - Review troubleshooting section above

---

## Files Reference

- **Workflow JSON:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/n8n-workflows/campaign-execute.json`
- **Environment File:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/.env.local`
- **Diagnosis Doc:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/N8N_ISSUE_DIAGNOSIS_OCT_31.md`
- **Upload Script (failed):** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/shell/upload-n8n-workflow.sh`

---

**Status:** Ready for manual import
**API Upload:** Not possible (401 Unauthorized)
**Manual Import:** Required (5 minutes)
**Next:** Import workflow + configure env vars + activate + test
