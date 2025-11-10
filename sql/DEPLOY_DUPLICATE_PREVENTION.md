# Deploy Database-Level Duplicate Prevention

## 🚨 CRITICAL: Deploy This Immediately

This fixes the LinkedIn rate limiting issue where the system was triggering warnings even though no CRs were sent. The problem: duplicate profile lookups were calling LinkedIn API repeatedly.

## What This Does

**Database function** `block_duplicate_prospects()` that:
1. Finds prospects whose LinkedIn URL or email was already contacted
2. Marks them as `duplicate_blocked` in the database
3. Prevents them from reaching N8N
4. Stops LinkedIn API calls BEFORE they happen

## Deployment Steps

### 1. Apply SQL Function to Supabase

Go to Supabase Dashboard → SQL Editor:

```sql
-- Copy and paste the entire contents of:
-- sql/block_duplicate_prospects.sql
```

Or run directly:

```bash
# From project root
cat sql/block_duplicate_prospects.sql | pbcopy
# Then paste into Supabase SQL Editor and run
```

### 2. Verify Function Created

```sql
-- Check function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'block_duplicate_prospects';

-- Expected: 1 row showing function name
```

### 3. Test the Function

```sql
-- Test with a real campaign (replace UUIDs)
SELECT * FROM block_duplicate_prospects(
  'YOUR_CAMPAIGN_ID'::UUID,
  'YOUR_WORKSPACE_ID'::UUID
);

-- Expected output:
-- blocked_count | blocked_prospects
-- --------------|------------------
-- 0 or more     | JSON array of blocked prospects
```

### 4. Deploy Application Code

```bash
# Already committed - just deploy
git push origin main

# Or if using Netlify CLI
netlify deploy --prod
```

## How It Works

### Before (OLD BEHAVIOR - CAUSED RATE LIMIT WARNINGS):
```
1. Query prospects from database
2. Send ALL prospects to N8N
3. N8N calls LinkedIn API for EACH prospect
4. LinkedIn sees repeated calls for same profiles
5. LinkedIn triggers rate limit warning
6. No CRs actually sent but account flagged
```

### After (NEW BEHAVIOR - PREVENTS API CALLS):
```
1. Call block_duplicate_prospects() function
   → Database marks duplicates as 'duplicate_blocked'
   → No LinkedIn API calls yet
2. Query prospects (excluding 'duplicate_blocked')
3. Send ONLY unique prospects to N8N
4. N8N calls LinkedIn API for unique profiles only
5. LinkedIn sees normal behavior
6. CRs sent successfully without warnings
```

## What You'll See in Logs

### Successful Blocking:
```
🛡️ Running database-level duplicate prevention...
✅ Duplicate prevention complete:
   Blocked 5 duplicate prospects
📋 Blocked prospects: [
  {"id": "...", "first_name": "John", "last_name": "Doe", "linkedin_url": "...", "duplicate_reason": "linkedin_url"}
]
```

### No Duplicates:
```
🛡️ Running database-level duplicate prevention...
✅ No duplicates found in this campaign
```

### Function Not Yet Deployed:
```
🛡️ Running database-level duplicate prevention...
⚠️ Duplicate blocking function error: function block_duplicate_prospects does not exist
   Continuing without blocking (function may not exist yet)
```

^ This means you need to deploy the SQL function

## Checking Blocked Prospects

### View all blocked duplicates:
```sql
SELECT
  c.name as campaign_name,
  cp.first_name,
  cp.last_name,
  cp.linkedin_url,
  cp.email,
  cp.status,
  cp.personalization_data->>'blocked_reason' as reason,
  cp.personalization_data->>'blocked_at' as blocked_at
FROM campaign_prospects cp
JOIN campaigns c ON cp.campaign_id = c.id
WHERE cp.status = 'duplicate_blocked'
ORDER BY cp.updated_at DESC
LIMIT 20;
```

### Count blocked per campaign:
```sql
SELECT
  c.name,
  COUNT(*) as blocked_count
FROM campaign_prospects cp
JOIN campaigns c ON cp.campaign_id = c.id
WHERE cp.status = 'duplicate_blocked'
GROUP BY c.name
ORDER BY blocked_count DESC;
```

## Troubleshooting

### Issue: Function not found
**Error**: `function block_duplicate_prospects does not exist`

**Fix**: Deploy the SQL function (step 1 above)

### Issue: Prospects still being duplicated
**Check**: Are they in different workspaces?

```sql
-- Function only blocks within same workspace
-- Check if duplicates are across workspaces:
SELECT
  w.name as workspace,
  cp.linkedin_url,
  COUNT(*) as times_contacted
FROM campaign_prospects cp
JOIN campaigns c ON cp.campaign_id = c.id
JOIN workspaces w ON c.workspace_id = w.id
WHERE cp.linkedin_url = 'https://linkedin.com/in/PROFILE_URL'
  AND (cp.status = 'connection_requested' OR cp.contacted_at IS NOT NULL)
GROUP BY w.name, cp.linkedin_url;
```

### Issue: Rate limit warnings still appearing
**Check**: Did you deploy both SQL function AND application code?

1. Verify function exists (see step 2)
2. Verify application deployed (check Netlify build time)
3. Check logs for "🛡️ Running database-level duplicate prevention"

## Rollback (if needed)

If something goes wrong:

```sql
-- Remove the function
DROP FUNCTION IF EXISTS block_duplicate_prospects(UUID, UUID);

-- Unblock all prospects (reset status)
UPDATE campaign_prospects
SET status = 'approved'
WHERE status = 'duplicate_blocked';
```

Then redeploy previous application code version.

## Success Criteria

✅ SQL function deployed (check with step 2)
✅ Application code deployed
✅ Logs show "Running database-level duplicate prevention"
✅ No LinkedIn rate limit warnings
✅ CRs being sent successfully
✅ No duplicate contacts across campaigns

---

**Questions?** Check logs for detailed blocking information.
**Still seeing issues?** Share logs from campaign execution.
