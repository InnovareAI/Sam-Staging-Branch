# N8N Webhook Signature Authentication Fix

## Problem Identified

**Issue:** Connection requests are NOT being sent because N8N workflow cannot update prospect status after messaging.

**Error:** `Authorization failed - please check your credentials (Missing N8N signature)`

**Root Cause:** N8N HTTP nodes calling back to SAM's API are missing the required HMAC signature header.

---

## Current Status

### Campaign: "Test 1- Mich" (ID: 4cd9275f-b82d-47d6-a1d4-7207b992c4b7)

- **Total prospects**: 10
- **Currently queued in N8N**: 4
- **Failed**: 6 (Unknown error - likely same signature issue)
- **Sent**: 0

### Why Connection Requests Aren't Sending

The N8N workflow is:
1. ✅ Receiving webhook from SAM
2. ✅ Processing prospects
3. ⚠️ Attempting to send LinkedIn messages (unclear if succeeding)
4. ❌ **FAILING** to update status in SAM database (signature missing)
5. ❌ SAM thinks messages weren't sent
6. ❌ Workflow shows as failed

---

## The Fix: Add HMAC Signature to N8N HTTP Nodes

### Step 1: Generate N8N_WEBHOOK_SECRET

First, we need to create a shared secret key for HMAC signature generation.

```bash
# Generate a random 32-character secret
openssl rand -hex 32

# Example output:
# a7f8d9e2c3b4a5f6e7d8c9b0a1f2e3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
```

**Save this secret - you'll need it in 2 places:**
1. N8N environment variables
2. SAM application `.env.local`

### Step 2: Add Secret to SAM Application

Edit `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/.env.local`:

```bash
# Add this line (use your generated secret from Step 1)
N8N_WEBHOOK_SECRET=a7f8d9e2c3b4a5f6e7d8c9b0a1f2e3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
```

**Then restart SAM application:**
```bash
# If running locally
npm run dev

# If deployed on Netlify
# Redeploy or set environment variable in Netlify dashboard
```

### Step 3: Configure N8N Environment Variable

In your N8N instance (https://workflows.innovareai.com):

1. Go to Settings → Environment Variables
2. Add new variable:
   - **Name**: `N8N_WEBHOOK_SECRET`
   - **Value**: (same secret from Step 1)
3. Save and restart N8N

### Step 4: Update N8N Workflow HTTP Nodes

Find the N8N workflow: **"Campaign Execute"** (the one triggered by SAM)

Locate **ALL** HTTP Request nodes that call back to SAM (likely these endpoints):
- `/api/webhooks/n8n/prospect-status`
- `/api/campaigns/linkedin/update-status`
- Any other SAM API callbacks

**For EACH HTTP Request node:**

#### Option A: Using N8N's Built-in HMAC Function (Recommended)

1. Open the HTTP Request node settings
2. Go to **Headers** section
3. Add a new header:
   - **Name**: `x-n8n-signature`
   - **Value** (click "Expression" mode and use this):
   ```javascript
   {{ $crypto.hmac($json.body || JSON.stringify($json), 'sha256', $env.N8N_WEBHOOK_SECRET, 'hex') }}
   ```

#### Option B: Using Function Node (If built-in doesn't work)

1. **Before** the HTTP Request node, add a new **Function** node
2. Name it: "Generate Webhook Signature"
3. Paste this code:

```javascript
const crypto = require('crypto');

// Get the request body that will be sent
const requestBody = JSON.stringify($input.item.json);

// Generate HMAC signature
const secret = $env.N8N_WEBHOOK_SECRET;
const signature = crypto
  .createHmac('sha256', secret)
  .update(requestBody)
  .digest('hex');

// Add signature to the item
return {
  json: {
    ...$input.item.json,
    _n8n_signature: signature,
    _request_body: requestBody
  }
};
```

4. In the HTTP Request node, add header:
   - **Name**: `x-n8n-signature`
   - **Value**: `{{ $json._n8n_signature }}`

### Step 5: Test the Fix

1. Save the N8N workflow
2. Activate the workflow
3. Retry failed prospects (see instructions below)

---

## How to Retry Failed Prospects

### Option 1: Reset Prospect Status (Recommended)

Run this SQL in Supabase:

```sql
-- Reset failed prospects to pending
UPDATE campaign_prospects
SET
  status = 'pending',
  contacted_at = NULL,
  personalization_data = jsonb_set(
    COALESCE(personalization_data, '{}'::jsonb),
    '{retry_attempt}',
    to_jsonb(COALESCE((personalization_data->>'retry_attempt')::int, 0) + 1)
  )
WHERE campaign_id = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7'
  AND status IN ('failed', 'queued_in_n8n');
```

Then re-execute the campaign via SAM UI or API.

### Option 2: Manual Retry via API

```bash
curl -X POST \
  "https://app.meet-sam.com/api/campaigns/linkedin/execute-live" \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_AUTH_COOKIE" \
  -d '{
    "campaignId": "4cd9275f-b82d-47d6-a1d4-7207b992c4b7",
    "maxProspects": 10
  }'
```

---

## Verification Steps

After applying the fix:

### 1. Check N8N Logs

In N8N workflow execution logs, look for:
- ✅ HTTP Request node succeeds (200 OK)
- ✅ No "401 Unauthorized" errors
- ✅ Response: `{"success": true, "updated": 1}`

### 2. Check SAM Database

```sql
-- Check prospect status updated successfully
SELECT
  first_name,
  last_name,
  status,
  contacted_at,
  personalization_data->>'unipile_message_id' as message_id
FROM campaign_prospects
WHERE campaign_id = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7'
  AND contacted_at > NOW() - INTERVAL '1 hour'
ORDER BY contacted_at DESC;
```

**Expected:**
- ✅ Status: `connection_requested`
- ✅ `contacted_at`: Recent timestamp
- ✅ `message_id`: Populated

### 3. Verify on LinkedIn

1. Go to https://linkedin.com
2. Click: My Network → Manage → Sent
3. Confirm connection requests appear for campaign prospects

---

## Troubleshooting

### Issue: "N8N_WEBHOOK_SECRET not defined"

**Solution:** Ensure environment variable is set in N8N and SAM application. Restart both services after setting.

### Issue: "Invalid signature"

**Possible causes:**
1. Secret mismatch between N8N and SAM
2. Request body modified before signing
3. Wrong hashing algorithm (must be SHA256)

**Debug:**
Check SAM logs for expected vs received signature:
```bash
# In SAM application logs
❌ Invalid N8N webhook signature
Expected: a7f8d9e2c3b4...
Received: b8e0f1a2d3c4...
```

### Issue: Still getting 401 errors

**Check:**
1. Header name is exactly `x-n8n-signature` (lowercase, with hyphen)
2. Signature is hex string (not base64)
3. Body sent to HMAC function matches actual HTTP request body

---

## Alternative: Temporarily Disable Signature Validation (NOT RECOMMENDED)

**Only use this for immediate testing. Re-enable ASAP.**

Edit `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/lib/security/webhook-auth.ts`:

```typescript
export async function verifyN8NWebhook(
  request: NextRequest,
  body: string
): Promise<{ valid: boolean; error?: NextResponse }> {
  // TEMPORARY: Disable signature validation
  console.warn('⚠️ WARNING: N8N signature validation DISABLED');
  return { valid: true };

  // ... rest of function
}
```

**This removes security. Only use temporarily while fixing N8N configuration.**

---

## Summary

**What's happening:**
- SAM triggers N8N webhook ✅
- N8N processes prospects ✅
- N8N sends LinkedIn messages ⚠️ (unclear)
- N8N tries to update SAM database ❌ (missing signature)
- SAM rejects callback (401 Unauthorized) ❌
- Workflow fails ❌

**What needs to happen:**
1. Generate shared secret (Step 1)
2. Add secret to SAM `.env.local` (Step 2)
3. Add secret to N8N environment (Step 3)
4. Update N8N HTTP nodes to include signature header (Step 4)
5. Retry failed prospects (Step 5)

**Expected result:**
- SAM triggers N8N webhook ✅
- N8N processes prospects ✅
- N8N sends LinkedIn messages ✅
- N8N updates SAM database with signature ✅
- SAM accepts callback (200 OK) ✅
- Workflow succeeds ✅
- Connection requests visible on LinkedIn ✅

---

**Created:** 2025-11-12
**For Campaign:** Test 1- Mich (4cd9275f-b82d-47d6-a1d4-7207b992c4b7)
**Status:** Ready to implement fix
