# Deployment: LinkedIn Account Sync & Proxy Display

**Date:** October 18, 2025  
**Commit:** 756c561  
**Status:** ✅ Deployed to Production

---

## Overview

This deployment fixes two critical issues with LinkedIn account management:

1. **LinkedIn Account Sync** - Prevents "No LinkedIn account connected" errors after disconnect/reconnect
2. **Proxy Location Display** - Shows actual Unipile-assigned proxy instead of "Not set"

---

## Problems Solved

### Problem 1: Search Fails After Reconnecting LinkedIn

**Symptom:**
- User disconnects LinkedIn account
- User reconnects via Unipile hosted auth
- Search fails with "No LinkedIn account connected"
- Manual database fix required

**Root Cause:**
- OAuth callback didn't always update `workspace_accounts` table
- Search looks in `workspace_accounts`, not `workspace_members`
- Old account ID stayed in database after reconnection

**Solution:**
- Created auto-sync system that runs after disconnect/reconnect
- Endpoint: `/api/linkedin/sync-workspace-accounts`
- Handles reconnections (same email, different Unipile ID)
- Cleans up stale account records

---

### Problem 2: Proxy Modal Shows "Not Set"

**Symptom:**
- Proxy modal always showed "Not set" for proxy location
- Users confused about whether proxy was working
- No visibility into actual Unipile proxy assignment

**Root Cause:**
- Modal only showed user's `profile_country` preference
- Never fetched actual proxy from Unipile
- Country selector was confusing (not actually used)

**Solution:**
- Created endpoint to fetch real proxy info from Unipile
- Endpoint: `/api/linkedin/proxy-info`
- Removed confusing country selector
- Shows actual proxy location, detected location, and connection status
- Added Paris default proxy warning

---

## New Features

### 1. LinkedIn Account Sync System

**File:** `/app/api/linkedin/sync-workspace-accounts/route.ts`

**What it does:**
1. Fetches all LinkedIn accounts from Unipile API
2. Fetches user's accounts from `user_unipile_accounts`
3. Compares with `workspace_accounts` table
4. **Adds** missing accounts
5. **Updates** existing accounts
6. **Deletes** stale accounts
7. **Handles reconnections** - removes old ID, adds new ID for same email

**When it runs:**
- Automatically after disconnect
- Automatically after reconnect
- Can be called manually for troubleshooting

**Example response:**
```json
{
  "success": true,
  "message": "LinkedIn accounts synced successfully",
  "summary": {
    "added": 1,
    "updated": 0,
    "deleted": 1,
    "errors": 0
  }
}
```

**Integration points:**
- `app/linkedin-integration/page.tsx` line 309-318 (after disconnect)
- `app/linkedin-integration/page.tsx` line 226-236 (after reconnect)

---

### 2. Proxy Info Display

**File:** `/app/api/linkedin/proxy-info/route.ts`

**What it does:**
1. Fetches LinkedIn accounts from `workspace_accounts`
2. Calls Unipile API for each account to get full details
3. Extracts proxy information from response
4. Returns structured data with actual proxy location

**Data returned:**
```json
{
  "success": true,
  "has_linkedin": true,
  "accounts": [{
    "account_id": "lN6tdIWOStK_dEaxhygCEQ",
    "account_name": "Thorsten Linz",
    "account_email": "tl@innovareai.com",
    "detected_location": "Germany",
    "detected_country": "DE",
    "proxy_country": "Germany",
    "proxy_city": "Berlin",
    "proxy_provider": "Unipile (Automatic)",
    "proxy_type": "Residential",
    "connection_status": "OK"
  }]
}
```

**Proxy location priority:**
1. `proxy_country` + `proxy_city` (actual assigned proxy)
2. `detected_country` (auto-detected from profile)
3. "Auto-assigned by Unipile" (fallback)

---

### 3. Enhanced Proxy Modal

**File:** `/app/page.tsx` (lines 5268-5520)

**Changes:**
- ❌ Removed confusing country selector dropdown
- ✅ Added info banner explaining how proxy assignment works
- ✅ Shows actual LinkedIn account email and name
- ✅ Shows detected location from LinkedIn profile
- ✅ Shows actual assigned proxy location
- ✅ Loading states while fetching
- ✅ Paris default proxy warning

**Paris Default Proxy Warning:**

If proxy is "France" or "Paris", shows yellow warning:
```
⚠️ Using Unipile default proxy. Update your LinkedIn location 
   and reconnect to get a country-specific proxy.
```

**Why Paris?** Unipile uses Paris, France as fallback when:
- LinkedIn profile location is not set
- Location is unclear/ambiguous
- Fresh account with incomplete profile

**How to fix:**
1. Update LinkedIn profile location (e.g., "Berlin, Germany")
2. Disconnect LinkedIn in our app
3. Reconnect via Unipile
4. New proxy assigned based on updated location

---

## API Endpoints

### POST `/api/linkedin/sync-workspace-accounts`

**Purpose:** Sync LinkedIn accounts from Unipile to workspace_accounts

**Auth:** Requires authenticated session

**Request:** None (uses current user)

**Response:**
```json
{
  "success": true,
  "message": "LinkedIn accounts synced successfully",
  "summary": {
    "added": 1,
    "updated": 0,
    "deleted": 1,
    "errors": 0
  },
  "workspace_id": "ecb08e55-2b7e-4d49-8f50-d38e39ce2482",
  "user_email": "ny@3cubed.ai"
}
```

**Use cases:**
- After disconnect/reconnect flow
- Troubleshooting "No LinkedIn account" errors
- Manual sync when accounts drift

---

### GET `/api/linkedin/proxy-info`

**Purpose:** Fetch actual proxy information from Unipile

**Auth:** Requires authenticated session

**Request:** None (uses current user)

**Response:**
```json
{
  "success": true,
  "has_linkedin": true,
  "accounts": [{
    "account_id": "lN6tdIWOStK_dEaxhygCEQ",
    "account_name": "Noriko Yokoi, Ph.D.",
    "account_email": "ny@3cubed.ai",
    "detected_location": "Germany",
    "detected_country": "DE",
    "proxy_country": "Germany",
    "proxy_city": "Berlin",
    "proxy_provider": "Unipile (Automatic)",
    "proxy_type": "Residential",
    "connection_status": "OK"
  }]
}
```

**Use cases:**
- Displaying proxy modal
- Verifying proxy assignment
- Troubleshooting proxy issues

---

## Troubleshooting

### Issue: "No LinkedIn account connected" after reconnect

**Diagnosis:**
```bash
# Check if account exists in workspace_accounts
SELECT * FROM workspace_accounts 
WHERE user_id = 'USER_ID' 
AND account_type = 'linkedin';
```

**Fix:**
1. Call sync endpoint manually:
```bash
curl -X POST https://app.meet-sam.com/api/linkedin/sync-workspace-accounts \
  -H "Cookie: your-session-cookie"
```

2. Or run script:
```bash
env $(cat .env.local | grep -v '^#' | xargs) \
  node scripts/add-noriko-new-linkedin.mjs
```

3. Or have user disconnect and reconnect (sync runs automatically)

---

### Issue: Proxy modal shows "No LinkedIn account connected"

**Diagnosis:**

This happens when:
- `workspace_accounts` table is out of sync
- Unipile account is disconnected/expired
- User has no workspace selected

**Check logs for:**
```
🔍 Fetching proxy info for user <email>
Failed to fetch account <id>: 404
```

**Fix:**
1. Run sync to update workspace_accounts
2. Check if Unipile account is still connected:
```bash
curl https://<DSN>.unipile.com:13443/api/v1/accounts/<account_id> \
  -H "X-API-KEY: <key>"
```

3. If account doesn't exist in Unipile, have user reconnect

---

### Issue: Proxy shows "France - Paris" 

**This is expected behavior** if:
- LinkedIn profile location was empty when connecting
- Profile location is unclear (e.g., "Remote" or "Global")
- Fresh LinkedIn account

**Fix:**
1. Update LinkedIn profile location to specific city/country
2. Disconnect LinkedIn from our app
3. Reconnect via Unipile
4. New proxy assigned based on updated location

**Note:** Proxy is assigned **during connection**, not after. Cannot change proxy without disconnect/reconnect.

---

## Testing

### Test 1: Verify Sync After Reconnect

1. Connect LinkedIn account
2. Verify search works
3. Click "Disconnect" in LinkedIn settings
4. Wait for confirmation
5. Reconnect via "Connect LinkedIn"
6. **Expected:** Search works immediately (no "account not found" error)
7. Check logs for `✅ Synced workspace accounts after reconnection`

### Test 2: Verify Proxy Display

1. Open User menu → Proxy Settings
2. **Expected:** Shows "Loading..." briefly, then actual proxy location
3. If Paris: Should show yellow warning
4. If Germany/other: Should show country and optionally city
5. Should show LinkedIn profile location separately
6. Should show connection status as "Active & Connected"

### Test 3: Verify Manual Sync

1. Manually delete record from `workspace_accounts`
2. Search should fail with "No LinkedIn account connected"
3. Call `/api/linkedin/sync-workspace-accounts`
4. Search should now work
5. Check response shows `"added": 1`

---

## Monitoring

### Key Metrics

Monitor these log patterns in production:

**Sync Operations:**
```
🔄 Syncing LinkedIn accounts for user <email>
📊 Found X LinkedIn accounts in Unipile
👤 User has X LinkedIn account(s) in user_unipile_accounts
🔍 Matched X user account(s) in Unipile
💾 User has X LinkedIn account(s) in workspace_accounts
✅ Sync complete - Added: X, Updated: Y, Deleted: Z
```

**Proxy Info Fetch:**
```
🔍 Fetching proxy info for user <email>
✅ Fetched proxy info for <name>: detected_location, proxy_country
```

**Errors to watch:**
```
❌ Failed to fetch Unipile accounts: <status>
❌ Failed to upsert account <id>: <error>
💥 Sync error: <error>
💥 Proxy info fetch error: <error>
```

### Success Indicators

- ✅ No "No LinkedIn account connected" errors after reconnect
- ✅ Sync logs show `Added: 1` after reconnect
- ✅ Proxy modal displays actual location (not "Not set")
- ✅ Paris warnings shown when appropriate
- ✅ Search works immediately after reconnect

---

## Database Schema

### Tables Involved

**`workspace_accounts`** - Main table for search
```sql
workspace_id UUID
user_id UUID
account_type TEXT ('linkedin')
account_identifier TEXT (email)
unipile_account_id TEXT (Unipile account ID)
connection_status TEXT ('connected', 'pending')
account_name TEXT
```

**`user_unipile_accounts`** - User-account associations
```sql
user_id UUID
unipile_account_id TEXT
platform TEXT ('LINKEDIN')
connection_status TEXT ('active')
```

**`workspace_members`** - User-workspace relationships
```sql
workspace_id UUID
user_id UUID
role TEXT
linkedin_unipile_account_id TEXT (legacy, not used)
```

---

## Rollback Plan

If issues occur, rollback steps:

1. **Revert code:**
```bash
git revert 756c561
git push origin main
```

2. **Disable auto-sync** (quick fix):
   - Comment out sync calls in `app/linkedin-integration/page.tsx`
   - Lines 312-314 (after disconnect)
   - Lines 229-236 (after reconnect)

3. **Manual fix for affected users:**
```sql
-- If user's account missing, add it
INSERT INTO workspace_accounts (
  workspace_id, user_id, account_type, 
  account_identifier, unipile_account_id, 
  connection_status
) VALUES (
  'WORKSPACE_ID', 'USER_ID', 'linkedin',
  'EMAIL', 'UNIPILE_ACCOUNT_ID', 'connected'
);
```

---

## Files Changed

1. ✅ `/app/api/linkedin/sync-workspace-accounts/route.ts` (new)
2. ✅ `/app/api/linkedin/proxy-info/route.ts` (new)
3. ✅ `/app/linkedin-integration/page.tsx` (updated sync calls)
4. ✅ `/app/page.tsx` (updated proxy modal)
5. ✅ `/docs/LINKEDIN_ACCOUNT_SYNC.md` (new documentation)
6. ✅ `/docs/PROXY_LOCATION_DISPLAY_FIX.md` (new documentation)

---

## Related Documentation

- [LinkedIn Account Sync System](/docs/LINKEDIN_ACCOUNT_SYNC.md)
- [Proxy Location Display Fix](/docs/PROXY_LOCATION_DISPLAY_FIX.md)
- [Unipile Proxy Documentation](https://developer.unipile.com/docs/connect-accounts#proxies)

---

## Support & Maintenance

**If a user reports:**
- "Search not working after reconnect" → Run manual sync or have them disconnect/reconnect
- "Proxy shows Not set" → Check if account exists in workspace_accounts
- "Proxy shows Paris but I'm in Germany" → Have them update LinkedIn location and reconnect

**Maintenance tasks:**
- Monitor sync success rate
- Track Paris proxy percentage (indicates profile location issues)
- Consider adding periodic background sync (daily cron)

---

**Deployed by:** Warp AI Agent  
**Reviewed by:** _Pending_  
**Production URL:** https://app.meet-sam.com
