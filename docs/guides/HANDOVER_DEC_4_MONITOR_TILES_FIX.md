# Handover Document: Monitor Tiles Fix - December 4, 2025

## Session Summary

Fixed critical issue where Commenting Agent monitor tiles wouldn't open when clicked. Users could see the tiles (e.g., "#GenAI", "#AgenticAI") but clicking them resulted in errors.

## Problem Statement

**User Report:** "these tiles here still don't open" - referring to Commenting Agent monitor tiles showing hashtag monitors.

**Error Observed:**
```json
{"error":"JSON object requested, multiple (or no) rows returned"}
```

## Root Cause Analysis

### Issue 1: RLS Blocking API Queries

The monitor detail API (`/api/linkedin-commenting/monitors/[id]`) used `createServerSupabaseClient()` which respects Row Level Security (RLS) policies. The RLS policies were blocking authenticated users from reading monitors.

**Why RLS Failed:**
- The `linkedin_post_monitors` table has RLS policies that check workspace membership
- The query was being made with the user's auth context
- RLS was returning zero rows (blocked), causing `.single()` to fail

### Issue 2: Undefined Variable Reference

The monitor posts API (`/api/linkedin-commenting/monitor-posts`) had variable references to `supabase` instead of `adminClient`, causing runtime errors.

## Technical Solution

### Fix 1: Use Admin Client with Manual Auth Checks

**File:** `app/api/linkedin-commenting/monitors/[id]/route.ts`

Changed from RLS-respecting client to admin client with explicit authorization:

```typescript
// BEFORE (broken)
const supabase = await createServerSupabaseClient();
const { data: monitor } = await supabase
  .from('linkedin_post_monitors')
  .select('*')
  .eq('id', monitorId)
  .single();  // Fails due to RLS

// AFTER (working)
const supabase = await createServerSupabaseClient();
const adminClient = supabaseAdmin();

// 1. First verify user is authenticated
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// 2. Get monitor with admin client (bypasses RLS)
const { data: monitor } = await adminClient
  .from('linkedin_post_monitors')
  .select('*')
  .eq('id', monitorId)
  .single();

// 3. Manually verify workspace access
const { data: member } = await adminClient
  .from('workspace_members')
  .select('role')
  .eq('workspace_id', monitor.workspace_id)
  .eq('user_id', user.id)
  .single();

if (!member) {
  return NextResponse.json({ error: 'Access denied' }, { status: 403 });
}
```

### Fix 2: Correct Variable References

**File:** `app/api/linkedin-commenting/monitor-posts/route.ts`

Fixed references from `supabase` to `adminClient`:

```typescript
// Line 56 - Changed from:
const { data: posts } = await supabase.from('linkedin_posts_discovered')...

// To:
const { data: posts } = await adminClient.from('linkedin_posts_discovered')...

// Line 74 - Changed from:
const { data: comments } = await supabase.from('linkedin_post_comments')...

// To:
const { data: comments } = await adminClient.from('linkedin_post_comments')...
```

## Files Modified

| File | Change |
|------|--------|
| `app/api/linkedin-commenting/monitors/[id]/route.ts` | Switched to admin client, added explicit auth/workspace checks |
| `app/api/linkedin-commenting/monitor-posts/route.ts` | Fixed variable references, added auth/workspace checks |

## Architecture Pattern: RLS vs Admin Client

This session established an important pattern for when to use each approach:

### Use `createServerSupabaseClient()` (RLS-respecting) when:
- Inserting data that should automatically get workspace_id from auth context
- User-facing CRUD where RLS should naturally filter data

### Use `supabaseAdmin()` (bypasses RLS) when:
- RLS policies are complex and may block legitimate access
- You need to verify access across multiple tables
- Performance is critical (single query vs multiple RLS checks)

**Key Rule:** When using admin client, ALWAYS manually verify:
1. User is authenticated (`auth.getUser()`)
2. User has workspace access (`workspace_members` lookup)

## Workspace Configuration (Also Fixed)

During investigation, discovered workspace assignment issues:

| Workspace | Owner | LinkedIn Account | Monitors |
|-----------|-------|------------------|----------|
| CM1 (aa1a214c) | Brian | Brian Neiby | 6 DataCenter monitors |
| CM2 (d4e5f6a7) | Pete | Pete Noble | 5 Bitcoin monitors |

Pete's Bitcoin monitors and LinkedIn account were incorrectly in Brian's workspace. Fixed by moving them to Pete's workspace (d4e5f6a7).

## Deployment

- **Deployed:** December 4, 2025
- **URL:** https://app.meet-sam.com
- **Verification:** Monitor tiles now open correctly

## Testing Verification

To verify the fix:
1. Go to Commenting Agent > Profiles page
2. Click on any monitor tile (e.g., "#GenAI")
3. Should navigate to `/workspace/{id}/commenting-agent/monitor/{monitorId}`
4. Should display monitor details and discovered posts

## Related Files

- **Monitor list page:** `app/workspace/[workspaceId]/commenting-agent/profiles/page.tsx`
- **Monitor detail page:** `app/workspace/[workspaceId]/commenting-agent/monitor/[monitorId]/page.tsx`
- **Monitor API:** `app/api/linkedin-commenting/monitors/[id]/route.ts`
- **Posts API:** `app/api/linkedin-commenting/monitor-posts/route.ts`

## Lessons Learned

1. **RLS can silently fail:** When `.single()` returns "multiple (or no) rows", first suspect RLS blocking
2. **Test with real user auth:** Admin/service role testing doesn't catch RLS issues
3. **Explicit is better:** Admin client + manual checks > complex RLS policies for multi-step authorization

## Next Steps for Future Development

1. Consider adding logging when RLS blocks queries (for debugging)
2. Document all API endpoints that use admin client vs RLS
3. Create test suite that verifies access with non-admin users
