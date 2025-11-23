# LinkedIn Commenting Agent - Complete Handover Document

**Date**: November 23, 2025
**Status**: 🔧 Database deployed, API updated, ready for testing
**Owner**: Engineering Team

---

## Executive Summary

The LinkedIn Commenting Agent is a multi-step workflow that automates LinkedIn engagement by:
1. Creating hashtag monitors (user-defined search campaigns)
2. Discovering posts matching those hashtags via N8N workflows
3. Generating AI comments using Claude 3.5 Sonnet
4. Routing comments through human approval (HITL)
5. Posting approved comments to LinkedIn via Unipile API
6. Tracking engagement and replies

**Current Status:**
- ✅ Database schema created and deployed to Supabase
- ✅ All 4 required tables exist and verified
- ✅ RLS policies configured for multi-tenant safety
- ✅ Monitor creation API updated to auto-detect workspace
- ⚠️ Testing in progress - "Internal server error" on campaign creation

---

## Database Schema (DEPLOYED)

### Tables Created

#### 1. `linkedin_post_monitors`
Stores user-created hashtag/keyword monitoring campaigns.

**Columns:**
- `id` (UUID) - Primary key
- `workspace_id` (UUID) - Links to workspace, enables multi-tenancy
- `hashtags` (TEXT[]) - Array of hashtags to monitor (#AI, #automation, etc)
- `keywords` (TEXT[]) - Array of keywords to search for
- `n8n_workflow_id` (VARCHAR) - ID of N8N workflow for this monitor
- `n8n_webhook_url` (TEXT) - Webhook URL for N8N callbacks
- `status` (VARCHAR) - 'active', 'paused', or 'archived'
- `created_by` (UUID) - User who created this monitor
- `created_at`, `updated_at` - Timestamps

**Constraints:**
- `workspace_hashtags_unique` - Can't have duplicate hashtag combinations per workspace

**Indexes:**
- `idx_linkedin_monitors_workspace` - Fast filtering by workspace
- `idx_linkedin_monitors_status` - Fast filtering by status
- `idx_linkedin_monitors_created_by` - Fast filtering by creator

---

#### 2. `linkedin_posts_discovered`
Stores LinkedIn posts found by N8N hashtag searches.

**Columns:**
- `id` (UUID) - Primary key
- `workspace_id` (UUID) - Workspace owner
- `monitor_id` (UUID) - Which monitor discovered this post
- `social_id` (VARCHAR) - LinkedIn post ID (`urn:li:ugcPost:123456`)
- `share_url` (TEXT) - Direct LinkedIn URL to post
- `post_content` (TEXT) - Full post text
- `author_name`, `author_profile_id`, `author_headline` - Author info
- `hashtags` (TEXT[]) - Hashtags in the post
- `post_date` (TIMESTAMP) - When the post was published
- `engagement_metrics` (JSONB) - `{comments: N, reactions: N, reposts: N}`
- `status` (VARCHAR) - 'discovered', 'processing', 'commented', or 'skipped'
- `skip_reason` (TEXT) - Why post was skipped (if applicable)

**Constraints:**
- `valid_status` CHECK - Ensures status is one of valid values
- `social_id` UNIQUE - LinkedIn post IDs are globally unique

**Indexes:**
- `idx_posts_discovered_workspace` - Fast workspace filtering
- `idx_posts_discovered_monitor` - Fast monitor linking
- `idx_posts_discovered_status` - Fast status filtering
- `idx_posts_discovered_social_id` - Fast LinkedIn ID lookup
- `idx_posts_discovered_date` - Fast sorting by post date DESC

---

#### 3. `linkedin_comment_queue`
Stores AI-generated comments awaiting approval before posting.

**Columns:**
- `id` (UUID) - Primary key
- `workspace_id` (UUID) - Workspace owner
- `post_id` (UUID) - Reference to linkedin_posts_discovered
- `post_social_id` (VARCHAR) - LinkedIn post ID (denormalized for speed)
- `comment_text` (TEXT) - Generated comment (max 1,250 chars for LinkedIn)
- `comment_length` (INTEGER) - Character count
- `requires_approval` (BOOLEAN) - Does this need human review?
- `approval_status` (VARCHAR) - NULL (pending), 'approved', or 'rejected'
- `approved_by` (UUID) - User who approved this comment
- `approved_at` (TIMESTAMP) - When approval happened
- `generated_by` (VARCHAR) - 'claude' or 'gpt'
- `generation_model` (VARCHAR) - Model name (e.g., 'claude-3.5-sonnet')
- `confidence_score` (FLOAT) - 0.0-1.0 confidence in comment quality
- `status` (VARCHAR) - 'pending', 'approved', 'rejected', 'posted', or 'failed'
- `posted_at` (TIMESTAMP) - When comment was posted to LinkedIn
- `error_message` (TEXT) - If status='failed', why it failed

**Constraints:**
- `valid_status` CHECK - Ensures status is valid
- `valid_approval` CHECK - approval_status must be NULL, 'approved', or 'rejected'

**Indexes:**
- `idx_comment_queue_workspace` - Fast workspace filtering
- `idx_comment_queue_post` - Fast post linking
- `idx_comment_queue_status` - Fast status filtering
- `idx_comment_queue_approval` - Fast approval status filtering
- `idx_comment_queue_created` - Fast sorting by creation time DESC

---

#### 4. `linkedin_comments_posted`
Tracks comments successfully posted to LinkedIn.

**Columns:**
- `id` (UUID) - Primary key
- `workspace_id` (UUID) - Workspace owner
- `post_id` (UUID) - Which post received this comment
- `queue_id` (UUID) - Reference to linkedin_comment_queue
- `comment_id` (VARCHAR) - LinkedIn's comment ID (from API response)
- `post_social_id` (VARCHAR) - LinkedIn post ID (denormalized)
- `comment_text` (TEXT) - The posted comment text
- `engagement_metrics` (JSONB) - `{reactions: N, replies: N, impressions: N}`
- `replies_count` (INTEGER) - Number of replies to our comment
- `user_replied` (BOOLEAN) - Did the post author reply to us?
- `last_reply_at` (TIMESTAMP) - When the last reply happened
- `posted_at` (TIMESTAMP) - When comment was posted
- `created_at`, `updated_at` - Tracking timestamps

**Constraints:**
- `comment_id` UNIQUE - LinkedIn comment IDs are globally unique

**Indexes:**
- `idx_comments_posted_workspace` - Fast workspace filtering
- `idx_comments_posted_post` - Fast post linking
- `idx_comments_posted_comment_id` - Fast LinkedIn comment lookup
- `idx_comments_posted_posted_at` - Fast sorting by post time DESC
- `idx_comments_posted_user_replied` - Fast filtering by reply status

---

### RLS Policies (SECURITY)

All 4 tables have Row Level Security enabled with policies that check `workspace_members` table:

**For each table, these policies exist:**
1. **SELECT** - Users can only see data for workspaces they're members of
2. **INSERT** - Users can only insert data into their workspace
3. **UPDATE** - Users can only update data in their workspace
4. **DELETE** - Users can only delete data in their workspace

**Key Policy Logic:**
```sql
EXISTS (
  SELECT 1 FROM workspace_members
  WHERE workspace_members.workspace_id = linkedin_post_monitors.workspace_id
  AND workspace_members.user_id = auth.uid()
)
```

This ensures users can only access data from workspaces where they're in `workspace_members` table.

---

### Helpful Views (Analytics)

#### `linkedin_queue_summary`
Shows queue status breakdown per workspace:
```sql
SELECT workspace_id, status, COUNT(*) as count, MIN(created_at) as earliest, MAX(created_at) as latest
```

Usage:
```sql
SELECT * FROM linkedin_queue_summary WHERE workspace_id = '...';
```

#### `linkedin_posted_with_engagement`
Shows posted comments with engagement metrics:
```sql
SELECT id, workspace_id, post_social_id, comment_text, replies_count,
  engagement_metrics->'reactions' as reactions,
  engagement_metrics->'replies' as replies,
  posted_at, user_replied, last_reply_at
```

#### `linkedin_active_monitors`
Shows only active monitoring campaigns:
```sql
SELECT id, workspace_id, hashtags, keywords, status, n8n_workflow_id, created_by, created_at
WHERE status = 'active'
```

---

## API Endpoints

### 1. Create Monitor (Campaign)
**Endpoint:** `POST /api/linkedin-commenting/monitors`

**Updated Behavior (Nov 23):**
- NO LONGER requires `workspace_id` in request body
- Automatically detects user's workspace from `workspace_members` table
- Sets `created_by` to current user

**Request Body:**
```json
{
  "hashtags": ["#AI", "#automation", "#DevTools"],
  "keywords": ["machine learning", "workflow automation"],
  "status": "active"
}
```

**Response (Success):**
```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "hashtags": ["#AI", "#automation", "#DevTools"],
  "keywords": ["machine learning", "workflow automation"],
  "status": "active",
  "created_by": "user-uuid",
  "created_at": "2025-11-23T...",
  "updated_at": "2025-11-23T..."
}
```

**Error Responses:**
- `401 Unauthorized` - User not authenticated
- `403 Forbidden` - User not in any workspace (not in workspace_members)
- `500 Internal Server Error` - Database error

**File:** `/app/api/linkedin-commenting/monitors/route.ts`

**Implementation Notes:**
- Logs detailed steps in console for debugging
- Checks auth, workspace membership, then inserts
- Returns full created monitor with all fields

---

### 2. List Monitors
**Endpoint:** `GET /api/linkedin-commenting/monitors?workspace_id=<id>`

**Response (Success):**
```json
{
  "monitors": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "hashtags": ["#AI"],
      "status": "active",
      ...
    }
  ]
}
```

**File:** `/app/api/linkedin-commenting/monitors/route.ts` (GET handler)

---

### 3. Generate AI Comments
**Endpoint:** `POST /api/linkedin-commenting/generate`

**Request Body:**
```json
{
  "post_id": "uuid",
  "workspace_id": "uuid"
}
```

**Response:** Generated comment with quality score

**File:** `/app/api/linkedin-commenting/generate/route.ts`

---

### 4. Post Comment to LinkedIn
**Endpoint:** `POST /api/linkedin-commenting/post`

**Request Body:**
```json
{
  "comment_queue_id": "uuid"
}
```

**File:** `/app/api/linkedin-commenting/post/route.ts`

---

### 5. Approve/Reject Comment
**Endpoint:** `PATCH /api/linkedin-commenting/approve/[id]`

**Request Body:**
```json
{
  "approval_status": "approved",
  "comment_text": "optional edited comment"
}
```

**File:** `/app/api/linkedin-commenting/approve/[id]/route.ts`

---

## Current Issues & Debugging

### Issue: "Failed to create campaign: Internal server error"

**Last Attempt:** Nov 23, 2025, ~23:58 UTC

**Root Cause Investigation:**
1. ✅ Database tables exist (verified)
2. ✅ RLS policies exist (2 policies on linkedin_post_monitors)
3. ❌ User workspace membership may not be set
4. ❌ Browser console error not yet captured

**Debugging Steps:**

1. **Check User in Workspace:**
```sql
SELECT user_id, workspace_id, role
FROM workspace_members
WHERE user_id = auth.uid();
```

If empty, need to add user:
```sql
INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'YOUR_USER_ID', 'owner');
```

2. **Check Function Logs:**
```bash
netlify logs:function
# Select "linkedin-commenting-monitors" from list
```

3. **Check Browser Console:**
- Open DevTools (F12)
- Go to Console tab
- Try creating a monitor again
- Look for detailed error message from API

4. **Verify Workspace ID:**
The workspace being used should be:
- InnovareAI IA1: `babdcab8-1a78-4b2f-913e-6e9fd9821009`

5. **Test RLS Policy:**
```sql
SELECT * FROM linkedin_post_monitors
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
```

Should return empty (no monitors yet) if you're in the workspace.

---

## System Architecture

```
User Creates Campaign
       ↓
POST /api/linkedin-commenting/monitors
  - Authenticate user
  - Get workspace_id from workspace_members
  - Insert into linkedin_post_monitors table
       ↓
Monitor Created (Database)
  - linkedin_post_monitors table
  - N8N workflow triggered via webhook
       ↓
N8N Workflow Execution
  - Call Unipile API to search hashtags
  - Filter posts by criteria
  - Save discovered posts via webhook
       ↓
Posts Saved to Database
  - linkedin_posts_discovered table
  - Status: 'discovered'
       ↓
AI Comment Generation
  - GET posts with status='discovered'
  - Call Claude 3.5 Sonnet API
  - Generate contextual, professional comments
  - Save to linkedin_comment_queue
       ↓
HITL Approval (Human-in-the-Loop)
  - User reviews generated comment
  - Can edit text or reject
  - Approve or reject in UI
       ↓
Post Comment to LinkedIn
  - Call Unipile API: POST /api/v1/posts/comments
  - Update linkedin_comment_queue: status='posted'
  - Save to linkedin_comments_posted
       ↓
Track Engagement
  - Monitor replies to our comment
  - Track reactions
  - Update engagement_metrics
```

---

## Unipile API Integration

### Key Endpoints

**1. Search LinkedIn Posts by Hashtag**
```
POST https://api6.unipile.com:13670/api/v1/linkedin/search
Headers:
  X-API-KEY: [UNIPILE_API_KEY]
Body:
  {
    "account_id": "unipile_account_id",
    "search_type": "posts",
    "keywords": "#AI #automation",
    "date_filter": "past_week",
    "sort_by": "date"
  }
```

**2. Post Comment**
```
POST https://api6.unipile.com:13670/api/v1/posts/comments
Headers:
  X-API-KEY: [UNIPILE_API_KEY]
Body:
  {
    "account_id": "unipile_account_id",
    "post_social_id": "urn:li:ugcPost:123456",
    "text": "Your comment here (max 1,250 chars)"
  }
Response:
  {
    "comment_id": "linkedin_comment_id",
    "status": "posted"
  }
```

**3. Get Comments on Post**
```
GET https://api6.unipile.com:13670/api/v1/posts/{social_id}/comments
Query: account_id, limit, cursor
```

### Critical Notes
- ⚠️ Always use `social_id` (urn:li:ugcPost:...) for post operations
- ⚠️ Comment max length: 1,250 characters
- ⚠️ Rate limit: 30-90 second delays between comments
- ⚠️ Account requirements: Profile must have activity history and connections

---

## N8N Integration

### Workflow Trigger
When a monitor is created, it should:
1. Store `n8n_workflow_id` in `linkedin_post_monitors`
2. Trigger N8N workflow via webhook
3. N8N searches hashtags periodically
4. Saves discovered posts back via API webhook

### Webhook Endpoint
`POST /api/linkedin-commenting/save-discovered-posts`

**Request Body:**
```json
{
  "monitor_id": "uuid",
  "posts": [
    {
      "social_id": "urn:li:ugcPost:123456",
      "share_url": "https://linkedin.com/feed/update/...",
      "post_content": "Post text here",
      "author_name": "John Doe",
      "author_profile_id": "john-doe-123",
      "author_headline": "Product Manager at Google",
      "post_date": "2025-11-23T12:00:00Z",
      "engagement_metrics": {
        "comments": 5,
        "reactions": 20,
        "reposts": 3
      }
    }
  ]
}
```

---

## Configuration & Environment Variables

### Required Environment Variables

**Supabase:**
```
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Unipile API:**
```
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=...
```

**OpenRouter (for Claude):**
```
OPENROUTER_API_KEY=...
```

**N8N:**
```
N8N_WEBHOOK_URL=https://workflows.innovareai.com
N8N_API_KEY=...
```

### Production Deployment (Netlify)
Use `netlify env:set` to configure:
```bash
netlify env:set UNIPILE_API_KEY "your-key-here"
netlify env:set UNIPILE_DSN "api6.unipile.com:13670"
netlify deploy --prod
```

---

## Testing Checklist

- [ ] **Monitor Creation**
  - [ ] User is in workspace_members
  - [ ] Create monitor via API
  - [ ] Monitor appears in database
  - [ ] Check Netlify logs for success

- [ ] **Post Discovery**
  - [ ] Trigger N8N workflow
  - [ ] Verify posts saved to linkedin_posts_discovered
  - [ ] Check status is 'discovered'

- [ ] **AI Comment Generation**
  - [ ] Generate comment for discovered post
  - [ ] Verify comment in linkedin_comment_queue
  - [ ] Check confidence_score

- [ ] **HITL Approval**
  - [ ] Review comment in UI
  - [ ] Edit comment text
  - [ ] Approve/reject

- [ ] **LinkedIn Posting**
  - [ ] Post approved comment to LinkedIn
  - [ ] Verify comment appears on LinkedIn
  - [ ] Check linkedin_comments_posted record

- [ ] **Engagement Tracking**
  - [ ] Monitor replies to our comment
  - [ ] Check engagement_metrics updated
  - [ ] Verify replies_count incremented

---

## Files & Locations

### API Routes
- `/app/api/linkedin-commenting/monitors/route.ts` - Create/list monitors
- `/app/api/linkedin-commenting/generate/route.ts` - Generate comments
- `/app/api/linkedin-commenting/post/route.ts` - Post to LinkedIn
- `/app/api/linkedin-commenting/approve/[id]/route.ts` - Approval workflow
- `/app/api/linkedin-commenting/save-discovered-posts/route.ts` - N8N webhook
- `/app/api/linkedin-commenting/pending-posts/route.ts` - List pending
- `/app/api/linkedin-commenting/ready-to-post/route.ts` - List ready

### Core Logic
- `/lib/services/linkedin-commenting-agent.ts` - Comment generation, validation

### Database
- `/sql/migrations/20251123_create_linkedin_commenting_tables.sql` - Schema
- `/sql/migrations/linkedin_commenting_clean.sql` - Clean version (no encoding issues)

### Documentation
- `/COMMENTING_AGENT_DEPLOYMENT.md` - Deployment guide
- `/COMMENTING_AGENT_ANALYSIS.md` - System analysis
- `/LINKEDIN_COMMENTING_AGENT_HANDOVER.md` - This document

---

## Known Issues & Limitations

### Current Issues
1. **Campaign Creation Error** - "Internal server error"
   - Status: 🔴 Under investigation
   - Last tested: Nov 23, 2025 ~23:58 UTC
   - Likely cause: User not in workspace_members
   - Solution: Add user to IA1 workspace in workspace_members table

### Design Limitations
1. **Hashtag Search** - Limited by Unipile's search depth
2. **Comment Length** - Max 1,250 characters per LinkedIn limit
3. **Rate Limiting** - Must wait 30+ seconds between comments
4. **Account Requirements** - Needs established LinkedIn account with connections
5. **Post Age** - Can only comment on posts < 30 days old
6. **Detection Risk** - Must vary timing, content, and patterns to appear natural

---

## Netlify Scheduled Functions (Cron Jobs)

### Purpose
Netlify scheduled functions handle periodic background tasks for the commenting agent without external dependencies (like cron-job.org). They run on a schedule to:

1. **Poll for discovered posts** - Check for new posts to comment on
2. **Auto-generate comments** - Generate AI comments on schedule (not just on-demand)
3. **Check email replies** - Monitor IMAP for LinkedIn comment replies
4. **Update engagement metrics** - Fetch latest engagement data from LinkedIn
5. **Post queued comments** - Batch post comments on schedule

### Configuration

**Netlify Function Setup:**
Create Netlify scheduled functions in `/netlify/functions/`:

**Example: Process LinkedIn Comments Function**
```javascript
// netlify/functions/process-linkedin-comments.js
export default async (req, context) => {
  // Runs on schedule defined in netlify.toml
  console.log('Processing LinkedIn comments at', new Date());

  try {
    // 1. Get discovered posts
    const posts = await getDiscoveredPosts();

    // 2. Generate comments for each post
    for (const post of posts) {
      await generateComment(post);
    }

    // 3. Check IMAP for replies
    await checkImapReplies();

    // 4. Update engagement metrics
    await updateEngagementMetrics();

    return { success: true, processed: posts.length };
  } catch (error) {
    console.error('Error processing comments:', error);
    return { error: error.message };
  }
};
```

**Netlify Configuration (netlify.toml):**
```toml
[functions]
directory = "netlify/functions"

# Scheduled functions
[[functions]]
node_bundle_dir = "netlify/functions"
schedule = "*/30 * * * *"  # Every 30 minutes

# LinkedIn comment processing
[[scheduled_functions]]
path = "process-linkedin-comments"
schedule = "*/30 * * * *"  # Every 30 minutes

# Email reply checking
[[scheduled_functions]]
path = "check-linkedin-email-replies"
schedule = "*/15 * * * *"  # Every 15 minutes

# Engagement metrics update
[[scheduled_functions]]
path = "update-linkedin-engagement"
schedule = "0 * * * *"     # Every hour
```

### Available Schedules (Cron Format)

Common patterns:
- `*/5 * * * *` - Every 5 minutes
- `*/15 * * * *` - Every 15 minutes
- `*/30 * * * *` - Every 30 minutes
- `0 * * * *` - Every hour
- `0 0 * * *` - Daily at midnight UTC
- `0 9 * * 1-5` - Weekdays at 9 AM UTC

### Required Functions

**1. process-linkedin-comments**
```
Schedule: Every 30 minutes
Tasks:
  - Get posts with status='discovered'
  - Generate AI comments
  - Save to linkedin_comment_queue
  - Update post status to 'processing'
```

**2. check-linkedin-email-replies**
```
Schedule: Every 15 minutes
Tasks:
  - Connect to IMAP
  - Read new emails
  - Match to posted comments
  - Update replies_count and user_replied
  - Store in engagement_metrics
```

**3. update-linkedin-engagement**
```
Schedule: Every hour
Tasks:
  - Get all posted comments from last 7 days
  - Call Unipile API for engagement data
  - Update engagement_metrics with reactions, reply counts
```

**4. post-approved-comments** (optional)
```
Schedule: Every 30 minutes
Tasks:
  - Get comments with approval_status='approved'
  - Call Unipile API to post
  - Update status to 'posted'
  - Move to linkedin_comments_posted table
```

### Environment Variables for Scheduled Functions
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Unipile
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=...

# IMAP
IMAP_HOST=imap.postmarkapp.com
IMAP_PORT=993
IMAP_EMAIL=...
IMAP_PASSWORD=...

# OpenRouter (Claude)
OPENROUTER_API_KEY=...
```

### Testing Status
🔴 **NOT YET TESTED** - Netlify scheduled functions need deployment and testing

**Test Checklist:**
- [ ] Scheduled functions deployed to Netlify
- [ ] Schedule runs at expected times (check logs)
- [ ] Database updates occur as expected
- [ ] Comments generated automatically on schedule
- [ ] Email replies checked and tracked
- [ ] Engagement metrics updated
- [ ] Error handling working (failures logged but don't break next run)

### Monitoring

**Check scheduled function execution:**
```bash
netlify logs
# Look for scheduled function output
```

**Verify database updates:**
```sql
-- Check if comments are being generated
SELECT COUNT(*) FROM linkedin_comment_queue
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check if engagement metrics are updating
SELECT COUNT(*) FROM linkedin_comments_posted
WHERE updated_at > NOW() - INTERVAL '1 hour';

-- Check if posts are being discovered
SELECT COUNT(*) FROM linkedin_posts_discovered
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Email Integration Setup (IMAP)

### Why IMAP?
IMAP enables the commenting agent to monitor and track email replies to LinkedIn comments. When comments get replies, they can trigger email notifications. IMAP is used to:
1. Monitor incoming email responses
2. Parse replies to track engagement
3. Trigger further actions based on reply content

### IMAP Configuration

**Email Service:** Postmark or ReachInbox (depending on tier)

**IMAP Server Details:**
```
Host: imap.postmarkapp.com or imap.reachbox.com
Port: 993 (SSL/TLS)
Username: Your email address
Password: IMAP token from service
```

**Environment Variables Needed:**
```
IMAP_HOST=imap.postmarkapp.com
IMAP_PORT=993
IMAP_EMAIL=your-email@domain.com
IMAP_PASSWORD=your-imap-token
IMAP_TLS=true
```

**Folder Structure:**
```
INBOX - Monitor for new replies
Sent - Track sent comments
LinkedIn - Organize LinkedIn-specific emails
```

### Integration Points
1. **When comment is posted** → Store email metadata
2. **Check IMAP periodically** → Look for replies
3. **Update engagement_metrics** → Track which comments got replies
4. **Trigger workflows** → On important replies (mentions, questions)

### Testing Status
🔴 **NOT YET TESTED** - IMAP setup needs end-to-end testing

**Test Checklist:**
- [ ] IMAP credentials configured
- [ ] Can connect to IMAP server
- [ ] Can read test email
- [ ] Replies to LinkedIn comments trigger email notifications
- [ ] Email replies are correctly parsed
- [ ] engagement_metrics updated with reply data

---

## Next Steps (Priority Order)

### P0 - CRITICAL (Fix immediately)
1. **Fix Campaign Creation Error**
   - Capture browser console error (F12 → Console)
   - Check if user is in workspace_members
   - Add user if needed: `INSERT INTO workspace_members ...`
   - Retry campaign creation

2. **Verify RLS Policies**
   ```sql
   SELECT * FROM pg_policies WHERE tablename LIKE 'linkedin%';
   ```

3. **Test Monitor Creation End-to-End**
   - Create monitor via API
   - Verify appears in database
   - Check Netlify logs

### P1 - HIGH (This week)
1. **Deploy & Test Netlify Scheduled Functions** ⚠️ CRITICAL
   - Create `/netlify/functions/process-linkedin-comments.js`
   - Create `/netlify/functions/check-linkedin-email-replies.js`
   - Create `/netlify/functions/update-linkedin-engagement.js`
   - Add schedule configuration to `netlify.toml`
   - Deploy to production
   - Monitor logs to verify execution
   - Test database updates (comments generated, engagement tracked)

2. **Test IMAP Email Integration** ⚠️ CRITICAL
   - Configure IMAP credentials in environment
   - Test connection to email server
   - Set up email monitoring for LinkedIn comments
   - Test end-to-end: Comment posted → Email reply received → Tracked in database

3. **Set Up N8N Workflow**
   - Create N8N workflow for hashtag searches
   - Configure Unipile API credentials
   - Set up webhook to save posts
   - Test with sample hashtag

3. **Test AI Comment Generation**
   - Generate comments for discovered posts
   - Review comment quality
   - Adjust Claude prompt if needed

4. **Build HITL Approval UI**
   - Create comment review page
   - Add edit/approve/reject buttons
   - Test approval workflow

### P2 - MEDIUM (Next 2 weeks)
1. **Test LinkedIn Posting**
   - Post approved comments to LinkedIn
   - Verify comments appear
   - Check engagement tracking

2. **Implement Engagement Monitoring**
   - Track replies to our comments
   - Monitor reaction counts
   - Update engagement_metrics

3. **Add Error Handling**
   - Handle failed comment posts
   - Retry logic with exponential backoff
   - Error notifications

---

## Support & Debugging

### Quick Diagnostics

**Check if tables exist:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'linkedin%' ORDER BY table_name;
```

**Check RLS policies:**
```sql
SELECT tablename, policyname FROM pg_policies
WHERE tablename LIKE 'linkedin%';
```

**Check user workspace membership:**
```sql
SELECT workspace_id, role FROM workspace_members
WHERE user_id = auth.uid();
```

**Check queue status:**
```sql
SELECT status, COUNT(*) FROM linkedin_comment_queue
GROUP BY status;
```

**Check posted comments:**
```sql
SELECT COUNT(*) as posted_count FROM linkedin_comments_posted;
```

### Common Errors

**"User not in any workspace"**
- Cause: User not in workspace_members table
- Fix: `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (...)`

**"RLS policy violation"**
- Cause: User trying to access workspace they're not in
- Fix: Add user to workspace_members for that workspace

**"Monitor not created"**
- Cause: API error (check logs)
- Debug: Look at Netlify function logs with detailed step-by-step output

**"N8N webhook not called"**
- Cause: n8n_workflow_id not set or webhook URL invalid
- Fix: Verify n8n_workflow_id is stored in database

---

## Contact & Questions

For issues or questions:
1. Check this handover document first
2. Review `/COMMENTING_AGENT_ANALYSIS.md` for architecture details
3. Check Netlify function logs for detailed error messages
4. Check browser console (F12) for API response details
5. Review `/COMMENTING_AGENT_DEPLOYMENT.md` for deployment steps

---

**Document Version**: 1.0
**Last Updated**: November 23, 2025, 23:59 UTC
**Status**: 🟡 Testing Phase - Database deployed, API functional, pending end-to-end test
