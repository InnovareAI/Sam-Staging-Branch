# Manual User Deletion Instructions

## User to Delete
- **Email**: ny@3cubed.ai
- **ID**: 567ba664-812c-4bed-8c2f-96113b99f899
- **Name**: Noriko Yokoi (NY)

## Why Manual Deletion?
Supabase restricts programmatic access to the `auth.users` table for security. The user must be deleted via:
1. Supabase Dashboard UI, OR
2. SQL Editor with proper permissions

---

## Method 1: Supabase Dashboard (Easiest - 30 seconds)

1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/auth/users
2. In the search box, type: `ny@3cubed.ai`
3. Click on the user row
4. Click the "Delete User" button (trash icon or three-dot menu)
5. Confirm deletion

**Done!**

---

## Method 2: SQL Editor (If Dashboard doesn't work)

1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new

2. Paste this SQL:

```sql
-- Delete ny@3cubed.ai user
DELETE FROM auth.users
WHERE id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Verify deletion (should return 0 rows)
SELECT email, id
FROM auth.users
WHERE id = '567ba664-812c-4bed-8c2f-96113b99f899';
```

3. Click "Run" (or press Cmd/Ctrl + Enter)

4. You should see:
   - First query: `DELETE 1` (1 row deleted)
   - Second query: (empty result - confirms deletion)

---

## Verification

After deletion, run this to confirm:

```bash
node temp/list-all-users.mjs
```

The user `ny@3cubed.ai` should NOT appear in the list.

---

## What Was Deleted

### ✅ Already Removed:
- 3cubed Workspace (ecb08e55-2b7e-4d49-8f50-d38e39ce2482)
- 1 campaign in that workspace
- 49 prospects in that campaign
- 1 workspace member record
- 1 workspace account record

### ⚠️ Still Needs Removal:
- Auth user: ny@3cubed.ai (567ba664-812c-4bed-8c2f-96113b99f899)

---

## Quick Link

**Direct link to delete user:**
https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/auth/users

Search for: `ny@3cubed.ai`

---

## After Deletion

The user will:
- No longer be able to log in
- Not appear in the users list
- Have all auth sessions invalidated
- Be completely removed from the system

**Total cleanup time:** < 1 minute via dashboard
