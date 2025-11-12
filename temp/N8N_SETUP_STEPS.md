# N8N Configuration Steps - IMMEDIATE ACTION REQUIRED

## ✅ Step 1: SAM Application Secret (DONE)

The webhook secret has been added to your `.env.local` file:

```
N8N_WEBHOOK_SECRET=a130520941cccec1ddbeb29cebb423088cf407ad142f3727279063336716b752
```

**If SAM is running locally:** Restart the dev server:
```bash
npm run dev
```

**If SAM is deployed on Netlify:** You need to add this environment variable:
1. Go to: https://app.netlify.com/sites/your-site/settings/env
2. Add new variable:
   - Key: `N8N_WEBHOOK_SECRET`
   - Value: `a130520941cccec1ddbeb29cebb423088cf407ad142f3727279063336716b752`
3. Redeploy the site

---

## 🔧 Step 2: N8N Environment Variable

### Option A: Via N8N UI (Recommended)

1. Go to: https://workflows.innovareai.com
2. Click on your profile (top right) → **Settings**
3. Click **Environment Variables** (left sidebar)
4. Click **Add Variable** button
5. Enter:
   - **Name**: `N8N_WEBHOOK_SECRET`
   - **Value**: `a130520941cccec1ddbeb29cebb423088cf407ad142f3727279063336716b752`
6. Click **Save**
7. **Restart N8N** (or reload workflows)

### Option B: Via N8N Environment File (If Self-Hosted)

If you're running N8N via Docker or self-hosted:

Edit your N8N environment file (usually `.env` or `docker-compose.yml`):

```bash
N8N_WEBHOOK_SECRET=a130520941cccec1ddbeb29cebb423088cf407ad142f3727279063336716b752
```

Then restart N8N:
```bash
docker-compose restart n8n
# or
pm2 restart n8n
```

---

## 🔌 Step 3: Update N8N Workflow

### Find the Workflow

1. Go to: https://workflows.innovareai.com/workflows
2. Find workflow: **"Campaign Execute"** or similar name
3. Open the workflow editor

### Locate HTTP Request Nodes

Look for HTTP Request nodes that call back to SAM's API. These typically call:
- `/api/webhooks/n8n/prospect-status`
- `/api/campaigns/linkedin/update-status`
- Any endpoint starting with `https://app.meet-sam.com/api/`

**There may be multiple nodes - update ALL of them.**

### Add Signature Header to Each Node

For EACH HTTP Request node calling SAM:

1. Click on the HTTP Request node
2. Scroll down to **Headers** section
3. Click **Add Option** → **Header**
4. Add a new header:
   - **Name**: `x-n8n-signature`
   - **Value**: Switch to **Expression** mode (click the ⚡ icon)
   - Enter this expression:

   ```javascript
   {{ $crypto.hmac(JSON.stringify($json), 'sha256', $env.N8N_WEBHOOK_SECRET, 'hex') }}
   ```

5. Click **Save**

### Example Configuration

**Before (Missing Signature):**
```
HTTP Request Node
├─ Method: POST
├─ URL: https://app.meet-sam.com/api/webhooks/n8n/prospect-status
├─ Headers:
│   └─ Content-Type: application/json
└─ Body: {{ $json }}
```

**After (With Signature):**
```
HTTP Request Node
├─ Method: POST
├─ URL: https://app.meet-sam.com/api/webhooks/n8n/prospect-status
├─ Headers:
│   ├─ Content-Type: application/json
│   └─ x-n8n-signature: {{ $crypto.hmac(JSON.stringify($json), 'sha256', $env.N8N_WEBHOOK_SECRET, 'hex') }}
└─ Body: {{ $json }}
```

### Save and Activate

1. Click **Save** (top right)
2. Ensure workflow is **Active** (toggle should be green)

---

## 🧪 Step 4: Test the Fix

### Reset Failed Prospects

Run this SQL in Supabase SQL Editor:

```sql
-- Reset failed prospects to retry them
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

### Re-Execute Campaign

Go to SAM UI and execute the campaign again, or use the test script I'll create next.

---

## 🎯 Step 5: Verify Success

### Check N8N Execution Logs

1. Go to: https://workflows.innovareai.com/executions
2. Find the latest execution of "Campaign Execute"
3. Click on it to view details
4. Look for the HTTP Request node that calls SAM
5. Check the response:
   - ✅ **200 OK** = Success!
   - ❌ **401 Unauthorized** = Signature still not working

### Check SAM Database

Run this in Supabase:

```sql
-- Check if prospects were updated successfully
SELECT
  first_name,
  last_name,
  status,
  contacted_at,
  personalization_data->>'unipile_message_id' as message_id
FROM campaign_prospects
WHERE campaign_id = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7'
  AND contacted_at > NOW() - INTERVAL '30 minutes'
ORDER BY contacted_at DESC;
```

**Expected Results:**
- `status` = `'connection_requested'`
- `contacted_at` = Recent timestamp
- `message_id` = Populated

### Verify on LinkedIn

1. Go to: https://www.linkedin.com/mynetwork/invitation-manager/sent/
2. Look for connection requests sent in last 30 minutes
3. Verify they match your campaign prospects

---

## 📝 Summary Checklist

- [ ] ✅ Added `N8N_WEBHOOK_SECRET` to SAM `.env.local` (DONE)
- [ ] Restarted SAM application (or updated Netlify env vars)
- [ ] Added `N8N_WEBHOOK_SECRET` to N8N environment variables
- [ ] Restarted N8N
- [ ] Updated ALL HTTP Request nodes in N8N workflow with signature header
- [ ] Saved and activated N8N workflow
- [ ] Reset failed prospects in database
- [ ] Re-executed campaign
- [ ] Verified N8N execution logs show 200 OK
- [ ] Verified database shows `connection_requested` status
- [ ] Verified LinkedIn shows sent connection requests

---

## 🚨 Troubleshooting

### "N8N_WEBHOOK_SECRET not found"

**Symptom:** N8N expression shows error: "Cannot read property of undefined"

**Fix:** Make sure you've added the environment variable in N8N settings and restarted N8N.

### "Invalid signature"

**Symptom:** Still getting 401 errors

**Check:**
1. Secret is EXACTLY the same in both SAM and N8N (no extra spaces)
2. Header name is `x-n8n-signature` (lowercase, with hyphen)
3. Expression uses `JSON.stringify($json)` to match the actual body sent
4. Using `sha256` algorithm (not sha1 or md5)

**Debug:** Check SAM logs for signature mismatch details.

### "Still not working"

If you've followed all steps and it's still failing, we can temporarily disable signature validation for testing:

**TEMPORARY FIX (NOT SECURE):**

Edit `lib/security/webhook-auth.ts` in SAM:

```typescript
export async function verifyN8NWebhook(
  request: NextRequest,
  body: string
): Promise<{ valid: boolean; error?: NextResponse }> {
  // TEMPORARY: Skip validation for debugging
  console.warn('⚠️ WARNING: Signature validation DISABLED');
  return { valid: true };
}
```

This will let messages send while we debug the signature issue.

---

## 🔐 Security Note

This HMAC signature ensures that only your N8N instance can update prospect status in SAM. Without it, anyone could call your API and modify campaign data.

**DO NOT:**
- Share the secret publicly
- Commit it to git (it's in `.env.local` which is gitignored)
- Use the same secret for multiple environments (dev/staging/prod should have different secrets)

---

**Secret Generated:** `a130520941cccec1ddbeb29cebb423088cf407ad142f3727279063336716b752`

**Next Action:** Follow Step 2 (add to N8N) and Step 3 (update workflow nodes)
