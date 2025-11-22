# LinkedIn Commenting Agent - Analysis & Implementation Plan

**Date**: November 23, 2025
**Status**: 🔴 **NEEDS DEBUGGING** (Campaign creation failing)

## Overview

The LinkedIn Commenting Agent is designed to:
1. **Monitor hashtags** - Find LinkedIn posts with specific hashtags
2. **Discover posts** - Save matching posts to database
3. **Generate comments** - Use AI to create contextual, professional comments
4. **Post comments** - Submit comments to LinkedIn via Unipile API
5. **Track engagement** - Monitor replies and interactions

## Current Implementation Status

### ✅ Components Built
- Monitor creation API: `/api/linkedin-commenting/monitors/route.ts`
- Post discovery & saving: `/api/linkedin-commenting/save-discovered-posts/route.ts`
- Comment generation: `/api/linkedin-commenting/generate/route.ts`
- Comment posting: `/api/linkedin-commenting/post/route.ts`
- Comment approval: `/api/linkedin-commenting/approve/[id]/route.ts`
- Helper endpoints (rate limit check, ready to post, pending posts)

### 🔴 Known Issues
**Campaign Creation Failing with "Internal Server Error"**
- Location: `/app/api/linkedin-commenting/monitors/route.ts` (POST)
- Symptoms: Error when creating a new commenting campaign
- Root causes (suspected):
  1. **Missing database table**: `linkedin_post_monitors` table might not exist
  2. **RLS policy issue**: Row-level security blocking insert operations
  3. **Workspace membership**: User not properly added to workspace_members
  4. **Missing column permissions**: Workspace_id or other required fields

### 📚 Required Database Tables

```sql
-- Main table for monitoring hashtags
CREATE TABLE linkedin_post_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  hashtags TEXT[] NOT NULL,
  keywords TEXT[],
  status VARCHAR(50) DEFAULT 'active',
  n8n_workflow_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Discovered posts from hashtag searches
CREATE TABLE linkedin_posts_discovered (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  monitor_id UUID REFERENCES linkedin_post_monitors(id),
  social_id VARCHAR(255) UNIQUE NOT NULL,
  share_url TEXT,
  post_content TEXT,
  author_name VARCHAR(255),
  author_profile_id VARCHAR(255),
  hashtags TEXT[],
  post_date TIMESTAMP,
  engagement_metrics JSONB,
  status VARCHAR(50) DEFAULT 'discovered',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Queue of comments to post
CREATE TABLE linkedin_comment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  post_id UUID REFERENCES linkedin_posts_discovered(id),
  post_social_id VARCHAR(255),
  comment_text TEXT NOT NULL,
  requires_approval BOOLEAN DEFAULT TRUE,
  approval_status VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  posted_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Track posted comments
CREATE TABLE linkedin_comments_posted (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  post_id UUID REFERENCES linkedin_posts_discovered(id),
  comment_id VARCHAR(255) UNIQUE NOT NULL,
  comment_text TEXT,
  posted_at TIMESTAMP,
  replies_count INTEGER DEFAULT 0,
  engagement_metrics JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Unipile API Integration

### Key Endpoints Needed

**1. Search Posts by Hashtag** (via N8N)
```
Method: POST
URL: /api/v1/linkedin/search
Body: {
  "account_id": "unipile_account_id",
  "search_type": "posts",
  "keywords": "#YourHashtag",
  "date_filter": "past_week",
  "sort_by": "date"
}
```

**2. Get Post Details**
```
Method: GET
URL: /api/v1/posts/{social_id}?account_id={account_id}
Header: X-API-KEY: {api_key}
Response includes: text, engagement_metrics, author info
```

**3. Post Comment**
```
Method: POST
URL: /api/v1/posts/comments
Body: {
  "account_id": "unipile_account_id",
  "post_social_id": "urn:li:ugcPost:123456",
  "text": "Your comment here",
  "mentions": [...]  # Optional
}
Returns: comment_id, status, timestamp
```

**4. Get Comments on Post**
```
Method: GET
URL: /api/v1/posts/{social_id}/comments
Query: account_id, limit, cursor
```

### Critical Notes
- ⚠️ **Always use `social_id`** for post operations (not share_url or post_id)
- ⚠️ **Format for ugcPost URLs**: `urn:li:ugcPost:[ID]`
- ⚠️ **Comment length**: Max 1,250 characters
- ⚠️ **Rate limits**: Implement 30-90 second delays between comments
- ⚠️ **Account requirements**: Profile must have activity history, connections

## System Architecture

```
┌──────────────────────────────────────┐
│   Campaign Creation (UI)             │
│   - Select hashtags                  │
│   - Configure approval workflow      │
└────────────┬──────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│   Monitor Created (Database)         │
│   linkedin_post_monitors table       │
│   N8N workflow triggered             │
└────────────┬──────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│   N8N Workflow (External)            │
│   1. Search hashtags (Unipile API)   │
│   2. Filter posts (N8N logic)        │
│   3. Save to DB (API call)           │
└────────────┬──────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│   Post Discovery (Database)          │
│   linkedin_posts_discovered table    │
│   Ready for comment generation       │
└────────────┬──────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│   AI Comment Generation              │
│   - Fetch post content               │
│   - Generate comment (Claude 3.5)    │
│   - Validate quality                 │
│   - Save to queue                    │
└────────────┬──────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│   Comment Queue (Database)           │
│   linkedin_comment_queue table       │
│   Awaiting approval (if enabled)     │
└────────────┬──────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│   HITL Approval (UI)                 │
│   - Review generated comments        │
│   - Edit if needed                   │
│   - Approve/Reject                   │
└────────────┬──────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│   Post Comment to LinkedIn            │
│   - Use Unipile API                  │
│   - Update queue status              │
│   - Log comment_id                   │
└────────────┬──────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│   Track Engagement                    │
│   linkedin_comments_posted table     │
│   Monitor replies & reactions        │
└──────────────────────────────────────┘
```

## Debugging Plan

### Step 1: Check Database Tables
```sql
-- In Supabase SQL editor:
SELECT * FROM information_schema.tables
WHERE table_name LIKE 'linkedin%';

-- Should show:
-- linkedin_post_monitors
-- linkedin_posts_discovered
-- linkedin_comment_queue
-- linkedin_comments_posted
```

### Step 2: Check RLS Policies
```sql
-- View RLS policies on linkedin_post_monitors:
SELECT * FROM pg_policies
WHERE tablename = 'linkedin_post_monitors';

-- Should allow:
-- INSERT for workspace members
-- SELECT for workspace members
-- UPDATE for workspace members
```

### Step 3: Check Workspace Membership
```sql
-- Verify user is in workspace_members:
SELECT * FROM workspace_members
WHERE workspace_id = 'YOUR_WORKSPACE_ID'
AND user_id = 'YOUR_USER_ID';

-- Should return a row with role (e.g., 'owner', 'member')
```

### Step 4: Enable Browser Console Logging
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try creating a campaign monitor
4. Look for detailed error message
5. Check Network tab for API response details

### Step 5: Check Netlify Function Logs
```bash
netlify logs --function linkedin-commenting-monitors --tail
```

## Implementation Checklist

### Database Setup (Priority: 🔴 HIGH)
- [ ] Create `linkedin_post_monitors` table
- [ ] Create `linkedin_posts_discovered` table
- [ ] Create `linkedin_comment_queue` table
- [ ] Create `linkedin_comments_posted` table
- [ ] Set up RLS policies for all tables
- [ ] Add indexes for performance

### API Endpoints (Priority: 🟡 MEDIUM)
- [x] POST /api/linkedin-commenting/monitors (create campaign)
- [x] GET /api/linkedin-commenting/monitors (list campaigns)
- [x] POST /api/linkedin-commenting/generate (AI comment generation)
- [x] POST /api/linkedin-commenting/post (post to LinkedIn)
- [x] GET /api/linkedin-commenting/pending-posts (list discovered)
- [ ] PATCH /api/linkedin-commenting/approve/[id] (approval workflow)

### N8N Workflow Setup (Priority: 🟡 MEDIUM)
- [ ] Create N8N workflow for hashtag search
- [ ] Connect to Unipile API for post discovery
- [ ] Implement filtering logic
- [ ] Set up webhook to save posts to database
- [ ] Add error handling and retries

### AI Comment Generation (Priority: 🟡 MEDIUM)
- [ ] Implement comment generation function
- [ ] Use Claude API with workspace context
- [ ] Validate comment quality and relevance
- [ ] Support personalization and variations
- [ ] Handle edge cases (sensitive topics, etc)

### HITL Approval Workflow (Priority: 🟢 LOW)
- [ ] Build comment approval UI
- [ ] Create edit/reject functionality
- [ ] Set up notification system
- [ ] Track approval audit trail

### LinkedIn Integration (Priority: 🟢 LOW)
- [ ] Implement Unipile post comment API call
- [ ] Handle errors and retry logic
- [ ] Add rate limiting (30-90s between comments)
- [ ] Track posted comments in database
- [ ] Monitor engagement metrics

## Known Limitations

1. **Hashtag Search**: Limited by Unipile's search depth and LinkedIn's indexing
2. **Comment Length**: 1,250 character limit on LinkedIn
3. **Rate Limiting**: Must wait 30+ seconds between comments to appear natural
4. **Account Activity**: Requires established LinkedIn account with connections
5. **Detection Evasion**: Must vary comment timing, content, and patterns
6. **Post Age**: Can only comment on relatively recent posts (< 30 days)

## Next Steps

**Immediate (Today/Tomorrow):**
1. Check if database tables exist in Supabase
2. Get browser console error logs from campaign creation attempt
3. Verify workspace membership and RLS policies
4. Run diagnostic queries in Supabase SQL editor

**This Week:**
1. Create missing database tables
2. Set up RLS policies correctly
3. Test campaign creation end-to-end
4. Fix any authorization issues

**Next Week:**
1. Set up N8N workflow for post discovery
2. Implement AI comment generation
3. Build HITL approval UI
4. Test full commenting workflow

## Files Reference

### API Routes
- `/app/api/linkedin-commenting/monitors/route.ts` - Campaign CRUD
- `/app/api/linkedin-commenting/monitors/poll/route.ts` - N8N webhook
- `/app/api/linkedin-commenting/generate/route.ts` - AI generation
- `/app/api/linkedin-commenting/post/route.ts` - LinkedIn posting
- `/app/api/linkedin-commenting/approve/[id]/route.ts` - Approval
- `/app/api/linkedin-commenting/pending-posts/route.ts` - List pending
- `/app/api/linkedin-commenting/ready-to-post/route.ts` - Ready queue
- `/app/api/linkedin-commenting/save-discovered-posts/route.ts` - Save posts
- `/app/api/linkedin-commenting/rate-limit-check/route.ts` - Rate limits

### Services
- `/lib/services/linkedin-commenting-agent.ts` - Core logic

### Documentation
- `/docs/LINKEDIN_COMMENTING_HANDOVER.md` - Feature handover (if exists)
- `CLAUDE.md` - Known issues section

## Testing Checklist

- [ ] Create a new monitor with hashtags
- [ ] Verify it's saved to database
- [ ] Check N8N workflow is triggered
- [ ] Confirm posts are discovered and saved
- [ ] Generate AI comments for discovered posts
- [ ] Approve/reject comments in UI
- [ ] Post comments to LinkedIn
- [ ] Verify comments appear on LinkedIn
- [ ] Check engagement tracking works
- [ ] Monitor reply notifications

---

**Status**: Ready to debug and implement
**Owner**: Engineering team
**Priority**: P2 (after queue system verified tomorrow)
