# N8N "Get LinkedIn Profile" Error Fix

## 🐛 Problem

**Error:** "Problem in node 'Get LinkedIn Profile' - Bad request - please check your parameters"

## 🔍 Root Cause

The "Get LinkedIn Profile" node calls:
```
GET https://{UNIPILE_DSN}/api/v1/users/{linkedin_username}?account_id={unipileAccountId}
```

But `unipileAccountId` is **undefined** because:

1. The webhook receives `unipileAccountId` at the top level:
   ```json
   {
     "unipileAccountId": "abc123",
     "prospects": [...]
   }
   ```

2. The "Split Prospects" node splits the array, losing the top-level `unipileAccountId`

3. The "Extract LinkedIn Username" node doesn't pass `unipileAccountId` through

4. The "Get LinkedIn Profile" node tries to use `$json.unipileAccountId` which doesn't exist

**Result:** Unipile API receives `account_id=undefined` → Bad request error

## ✅ Solution

Update the **"Extract LinkedIn Username"** node code to get `unipileAccountId` from the webhook:

### Current Code (BROKEN):
```javascript
// Extract LinkedIn username from URL
const linkedinUrl = $input.item.json.linkedin_url;
const username = linkedinUrl.split('/in/')[1]?.split('?')[0]?.replace('/', '');

if (!username) {
  throw new Error('Invalid LinkedIn URL: ' + linkedinUrl);
}

return {
  ...items[0].json,
  linkedin_username: username
};
```

### Fixed Code:
```javascript
// Extract LinkedIn username from URL and get unipileAccountId from webhook
const linkedinUrl = $input.item.json.linkedin_url;
const username = linkedinUrl.split('/in/')[1]?.split('?')[0]?.replace('/', '');

if (!username) {
  throw new Error('Invalid LinkedIn URL: ' + linkedinUrl);
}

// CRITICAL FIX: Get unipileAccountId from the webhook node
const webhookData = $node["Campaign Webhook"].json;
const unipileAccountId = webhookData.unipileAccountId;

if (!unipileAccountId) {
  throw new Error('Missing unipileAccountId from webhook data');
}

return {
  ...items[0].json,
  linkedin_username: username,
  unipileAccountId: unipileAccountId  // Now available for Get LinkedIn Profile node
};
```

## 📝 How to Apply Fix

1. Open N8N workflow: **SAM LinkedIn Campaign Execution v2**
2. Click on the **"Extract LinkedIn Username"** node
3. Replace the code with the fixed version above
4. Click **"Execute Node"** to test
5. Save the workflow

## ✅ Verification

After applying the fix:

1. The "Extract LinkedIn Username" node should output:
   ```json
   {
     "id": "...",
     "first_name": "...",
     "linkedin_url": "...",
     "linkedin_username": "john-smith",
     "unipileAccountId": "abc123"  ← Should be present
   }
   ```

2. The "Get LinkedIn Profile" node should successfully call:
   ```
   GET https://{UNIPILE_DSN}/api/v1/users/john-smith?account_id=abc123
   ```

3. No more "Bad request" errors!

## 🔍 Alternative Fix (If Above Doesn't Work)

If the webhook data structure is different, try this alternative:

```javascript
// Alternative: Get from first webhook item
const webhookData = $items("Campaign Webhook")[0].json;
const unipileAccountId = webhookData.unipileAccountId;

// Or if it's in query params:
const unipileAccountId = $node["Campaign Webhook"].json.query?.unipileAccountId;
```

To debug, add this to see what's available:
```javascript
console.log('Webhook data:', JSON.stringify($node["Campaign Webhook"].json, null, 2));
```

## 📊 Testing

Test the fix with this manual webhook call:

```bash
curl -X POST https://workflows.innovareai.com/webhook/sam-campaign-execute \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "014509ba-226e-43ee-ba58-ab5f20d2ed08",
    "campaignId": "test-campaign-id",
    "unipileAccountId": "YOUR_UNIPILE_ACCOUNT_ID",
    "prospects": [{
      "id": "test-1",
      "first_name": "Test",
      "last_name": "User",
      "linkedin_url": "https://www.linkedin.com/in/testuser"
    }]
  }'
```

**Expected:** Workflow executes without "Bad request" error.

## 🎯 Summary

- **Issue:** `unipileAccountId` not passed through Split Prospects
- **Fix:** Extract it from webhook node in "Extract LinkedIn Username"
- **Impact:** Fixes "Bad request" errors in "Get LinkedIn Profile"
- **Test:** Run workflow and verify no errors

---

**Fixed by:** Claude AI
**Date:** 2025-11-07
**Status:** Ready to apply in N8N
