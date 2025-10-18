# LinkedIn Account Sync System

## Problem
When users disconnect and reconnect their LinkedIn accounts, the `workspace_accounts` table can get out of sync with what's actually in Unipile. This causes the search to fail with "No LinkedIn account connected" even though the account is connected in Unipile.

## Root Cause
1. User disconnects LinkedIn via the UI disconnect button
2. This deletes the account from `workspace_accounts` and Unipile
3. User reconnects via Unipile hosted auth
4. OAuth callback (`/api/unipile/hosted-auth/callback`) should add to `workspace_accounts`
5. **BUT** if the OAuth flow is interrupted or times out, the account stays in Unipile but not in `workspace_accounts`

## Solution
Created a sync endpoint that ensures `workspace_accounts` is always in sync with Unipile.

### Sync Endpoint
**POST** `/api/linkedin/sync-workspace-accounts`

This endpoint:
1. Fetches all LinkedIn accounts from Unipile
2. Fetches user's LinkedIn accounts from `user_unipile_accounts`
3. Compares with `workspace_accounts`
4. **Adds** any accounts in Unipile but missing from `workspace_accounts`
5. **Updates** existing accounts with latest connection status
6. **Deletes** accounts in `workspace_accounts` that no longer exist in Unipile
7. **Handles reconnections** - if same email but different `unipile_account_id`, deletes old and adds new

### When Sync is Called

#### 1. After Disconnect
In `app/linkedin-integration/page.tsx` line 309-318:
```typescript
// Sync workspace accounts after disconnect
setTimeout(async () => {
  try {
    await fetch('/api/linkedin/sync-workspace-accounts', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (e) {
    console.log('Sync after disconnect completed');
  }
  checkLinkedInConnection();
}, 1000);
```

#### 2. After Reconnect
In `app/linkedin-integration/page.tsx` line 226-236:
```typescript
// Sync workspace accounts first
try {
  await fetch('/api/linkedin/sync-workspace-accounts', {
    method: 'POST',
    credentials: 'include'
  });
  console.log('✅ Synced workspace accounts after reconnection');
} catch (e) {
  console.log('⚠️  Sync after reconnection had issues');
}
```

### Manual Sync
If a user reports "No LinkedIn account connected" but they know they connected:

**Option 1: Via API (for developers)**
```bash
curl -X POST https://app.meet-sam.com/api/linkedin/sync-workspace-accounts \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json"
```

**Option 2: Via Script**
```bash
# Run the manual sync script we created
env $(cat .env.local | grep -v '^#' | xargs) node scripts/add-noriko-new-linkedin.mjs
```

**Option 3: Ask user to**
1. Disconnect LinkedIn
2. Reconnect LinkedIn
3. The sync will run automatically

## Database Tables Involved

### `user_unipile_accounts`
- Links Unipile accounts to users
- Updated via OAuth callback
- Source of truth for which accounts belong to which users

### `workspace_accounts`
- Links accounts to workspaces
- Used by search to find available LinkedIn accounts
- **THIS is what gets out of sync**

### `workspace_members`
- Links users to workspaces
- Has `linkedin_unipile_account_id` field for "primary" LinkedIn (legacy)

## Testing
To test the sync works:

1. **Setup**: Connect a LinkedIn account
2. **Verify**: Search should work
3. **Disconnect**: Click disconnect button
4. **Manually add to Unipile**: Re-authenticate via hosted auth (don't let callback complete)
5. **Observe**: User will see "No LinkedIn account connected"
6. **Sync**: POST to `/api/linkedin/sync-workspace-accounts`
7. **Verify**: Search should now work

## Future Improvements

### 1. Periodic Background Sync
Add a cron job to sync all users' accounts daily:
```typescript
// In a new API route: /api/cron/sync-linkedin-accounts
export async function GET() {
  // Fetch all users with LinkedIn accounts
  // Call sync for each user
  // Report summary
}
```

### 2. Webhook from Unipile
Configure Unipile to send webhooks when accounts are added/removed:
```typescript
// In a new API route: /api/webhooks/unipile-account
export async function POST(request: NextRequest) {
  const { event, account_id, user_context } = await request.json();
  
  if (event === 'account.connected') {
    // Sync this specific account
  }
  
  if (event === 'account.disconnected') {
    // Remove from workspace_accounts
  }
}
```

### 3. Automatic Sync on Search Failure
Update the search endpoint to auto-sync if it finds no accounts:
```typescript
// In /api/linkedin/search/simple/route.ts
if (ownAccounts.length === 0) {
  // Try syncing first
  await fetch('/api/linkedin/sync-workspace-accounts', { ... });
  
  // Retry search
  const { data: accountsAfterSync } = await supabase...
  
  if still no accounts, return error
}
```

## Rollout Plan
1. ✅ Create sync endpoint
2. ✅ Add sync to disconnect flow
3. ✅ Add sync to reconnect flow
4. ⏳ Test with Noriko's account
5. ⏳ Monitor logs for sync errors
6. ⏳ Add periodic background sync (optional)
7. ⏳ Add Unipile webhook (optional)

## Monitoring
Check logs for:
- `🔄 Syncing LinkedIn accounts for user` - Sync started
- `✅ Sync complete - Added: X, Updated: Y, Deleted: Z` - Sync finished
- `❌ Failed to upsert account` - Sync errors

## Related Files
- `/app/api/linkedin/sync-workspace-accounts/route.ts` - Sync endpoint
- `/app/linkedin-integration/page.tsx` - UI that calls sync
- `/app/api/unipile/hosted-auth/callback/route.ts` - OAuth callback (already has sync logic)
- `/app/api/linkedin/disconnect/route.ts` - Disconnect endpoint
- `/app/api/linkedin/search/simple/route.ts` - Search endpoint that uses workspace_accounts
