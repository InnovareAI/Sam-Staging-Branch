# LinkedIn Commenting Agent - Database Setup & Deployment

**Date**: November 23, 2025
**Status**: 🔧 **READY TO DEPLOY**

## Quick Start

### Step 1: Deploy Migration to Supabase

1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Click **SQL Editor** in left sidebar
3. Click **New Query**
4. Open file: `sql/migrations/20251123_create_linkedin_commenting_tables.sql`
5. Copy entire SQL file
6. Paste into Supabase SQL editor
7. Click **Run** button
8. Should see: `✓ Execution completed successfully`

### Step 2: Verify Tables Created

Run this query in Supabase SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name LIKE 'linkedin%'
ORDER BY table_name;
```

Should return:
```
linkedin_comment_queue
linkedin_comments_posted
linkedin_post_monitors
linkedin_posts_discovered
```

### Step 3: Verify RLS Policies

Run this query:

```sql
SELECT tablename, policyname, permissive, roles
FROM pg_policies
WHERE tablename LIKE 'linkedin%'
ORDER BY tablename, policyname;
```

Should show policies for select, insert, update, delete on all 4 tables.

### Step 4: Test Monitor Creation

```bash
# Call the API to create a monitor
curl -X POST 'https://app.meet-sam.com/api/linkedin-commenting/monitors' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -d '{
    "workspace_id": "YOUR_WORKSPACE_ID",
    "hashtags": ["#AI", "#automation"],
    "keywords": ["machine learning", "workflow"],
    "status": "active"
  }'
```

Should return:
```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "hashtags": ["#AI", "#automation"],
  "keywords": ["machine learning", "workflow"],
  "status": "active",
  "created_at": "2025-11-23T...",
  "created_by": "user-uuid"
}
```

## What Was Created

### 4 Database Tables

#### 1. linkedin_post_monitors
- Stores hashtag monitors created by users
- Links to N8N workflows for post discovery
- Tracks active/paused/archived status
- Fields: workspace_id, hashtags, keywords, n8n_workflow_id, status, created_by

#### 2. linkedin_posts_discovered
- Posts found by N8N from hashtag searches
- Contains post content, author info, engagement metrics
- Tracks processing status (discovered → processing → commented)
- Fields: workspace_id, monitor_id, social_id, share_url, post_content, author_*, engagement_metrics, status

#### 3. linkedin_comment_queue
- AI-generated comments awaiting approval
- Tracks approval workflow (pending → approved → posted)
- Stores comment text and generation metadata
- Fields: workspace_id, post_id, comment_text, requires_approval, approval_status, status

#### 4. linkedin_comments_posted
- Comments successfully posted to LinkedIn
- Tracks engagement (replies, reactions)
- Monitors user responses to our comments
- Fields: workspace_id, post_id, comment_id, comment_text, engagement_metrics, replies_count

### RLS Policies

All 4 tables have Row Level Security policies that ensure:
- Users can only see data for workspaces they're members of
- Users can only insert/update/delete their workspace's data
- Data is automatically filtered by workspace_id via workspace_members table

### Indexes

Optimized for performance:
- `workspace_id` - Fast filtering by workspace
- `status` - Fast filtering by processing status
- `social_id` - Fast LinkedIn post lookups
- `post_date` - Fast sorting by post date
- `created_at` - Fast sorting by creation time
- `comment_id` - Unique constraint on LinkedIn comment IDs

### Views (Optional, for Analytics)

```sql
-- linkedin_queue_summary: See queue status counts
SELECT * FROM linkedin_queue_summary;

-- linkedin_posted_with_engagement: See posted comments with engagement
SELECT * FROM linkedin_posted_with_engagement;

-- linkedin_active_monitors: See active monitoring campaigns
SELECT * FROM linkedin_active_monitors;
```

## Deployment Steps (Detailed)

### Option A: Deploy via Supabase Dashboard (Recommended)

1. **Open Supabase**
   - URL: https://supabase.com/dashboard
   - Project: devin-next-gen-prod (latxadqrvrrrcvkktrog)

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query" button

3. **Copy Migration SQL**
   - Open file: `sql/migrations/20251123_create_linkedin_commenting_tables.sql`
   - Select all (Cmd+A)
   - Copy (Cmd+C)

4. **Paste into Supabase**
   - Click in Supabase SQL editor
   - Paste (Cmd+V)
   - Click "Run" button

5. **Verify Success**
   - Should show: "Query executed successfully"
   - Wait 5-10 seconds for indexes to build

6. **Test Creation**
   - Run verification queries above
   - Try creating a monitor via API

### Option B: Deploy via Supabase Migrations Feature (Advanced)

1. **Create migration file** (already done):
   - File: `sql/migrations/20251123_create_linkedin_commenting_tables.sql`

2. **Push via Supabase CLI**:
   ```bash
   npm install supabase
   supabase db push
   ```

3. **Verify**:
   - Check Supabase dashboard for migration status
   - Run verification queries

## Verifying Deployment

### Check 1: Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'linkedin%'
ORDER BY table_name;
```

Expected result:
```
linkedin_comment_queue
linkedin_comments_posted
linkedin_post_monitors
linkedin_posts_discovered
```

### Check 2: Columns Correct

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name LIKE 'linkedin%'
ORDER BY table_name, ordinal_position
LIMIT 20;
```

### Check 3: RLS Enabled

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename LIKE 'linkedin%';
```

Expected: `rowsecurity = true` for all tables

### Check 4: RLS Policies

```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE tablename LIKE 'linkedin%'
ORDER BY tablename;
```

Should show ~16 policies total (4 policies per table: select, insert, update, delete)

### Check 5: Indexes Created

```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename LIKE 'linkedin%'
ORDER BY tablename, indexname;
```

### Check 6: API Can Create Monitor

```bash
# Test create monitor endpoint
curl -X POST 'https://app.meet-sam.com/api/linkedin-commenting/monitors' \
  -H 'Content-Type: application/json' \
  -d '{
    "workspace_id": "YOUR_WORKSPACE_ID",
    "hashtags": ["#test"],
    "keywords": ["test"],
    "status": "active"
  }'
```

## Troubleshooting

### Error: Table already exists

If you get: `CREATE TABLE IF NOT EXISTS ... already exists`

**Solution**: This is fine! The migration uses `IF NOT EXISTS`, so it won't fail if tables already exist.

### Error: Permission denied

If you get: `permission denied for schema public`

**Cause**: Using wrong database role
**Solution**: Use the **default** Supabase connection (not custom role)

### Error: RLS policies fail to create

If you get: `ERROR: rls policy ... failed`

**Cause**: Tables might not exist yet, or RLS not enabled
**Solution**:
1. Run table creation statements first
2. Then enable RLS
3. Then create policies

### API still returns error

If `/api/linkedin-commenting/monitors` POST still fails:

1. **Check Netlify logs**:
   ```bash
   netlify logs --function linkedin-commenting-monitors --tail
   ```

2. **Run SQL check**:
   ```sql
   SELECT * FROM information_schema.tables
   WHERE table_name = 'linkedin_post_monitors';
   ```

3. **Check RLS policies**:
   ```sql
   SELECT * FROM pg_policies
   WHERE tablename = 'linkedin_post_monitors';
   ```

4. **Verify workspace_members**:
   ```sql
   SELECT * FROM workspace_members
   WHERE workspace_id = 'YOUR_WORKSPACE_ID';
   ```

## Next Steps After Deployment

### 1. Test Monitor Creation (5 min)
- Create a new monitor via API
- Verify it appears in database
- Check Netlify logs for success

### 2. Set Up N8N Workflow (30 min)
- Create N8N workflow for hashtag searches
- Configure Unipile API call
- Set up webhook to save posts
- Test with sample hashtag

### 3. Test Comment Generation (15 min)
- Generate AI comments for discovered posts
- Review generated comments
- Test approval workflow

### 4. Test LinkedIn Posting (15 min)
- Post approved comments to LinkedIn
- Verify comments appear
- Check comment tracking

## Files Included

**Migration SQL**:
- `sql/migrations/20251123_create_linkedin_commenting_tables.sql` (500+ lines)

**Existing API Endpoints** (already built):
- `/app/api/linkedin-commenting/monitors/route.ts` - Create/list monitors
- `/app/api/linkedin-commenting/generate/route.ts` - AI comment generation
- `/app/api/linkedin-commenting/post/route.ts` - Post to LinkedIn
- `/app/api/linkedin-commenting/approve/[id]/route.ts` - Approval workflow

**Core Logic**:
- `/lib/services/linkedin-commenting-agent.ts` - Comment generation, validation

## Quick Reference

### Create Monitor
```javascript
POST /api/linkedin-commenting/monitors
Body: {
  workspace_id: "uuid",
  hashtags: ["#hashtag1", "#hashtag2"],
  keywords: ["keyword1", "keyword2"],
  status: "active"
}
```

### List Monitors
```javascript
GET /api/linkedin-commenting/monitors?workspace_id=uuid
```

### Generate Comments
```javascript
POST /api/linkedin-commenting/generate
Body: {
  post_id: "uuid",
  workspace_id: "uuid"
}
```

### Post Comment
```javascript
POST /api/linkedin-commenting/post
Body: {
  comment_queue_id: "uuid"
}
```

### Approve Comment
```javascript
PATCH /api/linkedin-commenting/approve/[id]
Body: {
  approval_status: "approved",
  comment_text: "optional edited comment"
}
```

## Support

If you encounter issues:

1. Check Netlify logs: `netlify logs --tail`
2. Check Supabase SQL Editor: Run verification queries
3. Check browser console: F12 → Console tab
4. Review COMMENTING_AGENT_ANALYSIS.md for detailed debugging

## Timeline

- **Now**: Deploy migration (5 min)
- **Next**: Test monitor creation (5 min)
- **Then**: Set up N8N workflow (30 min)
- **Finally**: Test full commenting workflow (30 min)

---

**Status**: Ready to deploy
**Estimated deployment time**: 10 minutes
**Estimated full setup**: 2-3 hours

Next: Run migration and test monitor creation!
