# LinkedIn Commenting Agent Data Model Analysis

**Date:** November 27, 2025
**Author:** Claude (Opus 4.5)
**Purpose:** Comprehensive analysis of table duplication, missing RLS policies, and schema inconsistencies

---

## Executive Summary

The LinkedIn Commenting Agent has **significant data model issues** that need immediate attention:

1. **Table Duplication:** There are **SEVEN different table patterns** for similar functionality, not just two
2. **Missing RLS DELETE Policies:** Multiple tables lack DELETE policies
3. **RLS Disabled on Sensitive Table:** `linkedin_proxy_assignments` has RLS disabled despite having policy definitions
4. **Schema Inconsistencies:** Column names vary across migrations and code
5. **Active vs Deprecated Tables:** Clear determination of canonical tables needed

---

## 1. Table Duplication Analysis

### Current State: Seven Table Groups

I discovered **SEVEN different table naming patterns** in the codebase:

| Table Pattern | Migration Source | Used in Code? | Data Present? |
|--------------|-----------------|---------------|---------------|
| `linkedin_posts_discovered` | `20251030000003_create_linkedin_commenting_agent.sql`, `013-fix-linkedin-commenting-schema.sql` | **YES** (20+ references) | 8 rows |
| `linkedin_discovered_posts` | `017-linkedin-commenting-complete-system.sql` | NO (only N8N workflow) | 0 rows |
| `linkedin_post_comments` | `018-create-linkedin-post-comments-table.sql` | YES (4 routes) | Unknown |
| `linkedin_comment_queue` | `20251030000003_create_linkedin_commenting_agent.sql`, `013-fix` | YES (generate, post routes) | Unknown |
| `linkedin_comments_posted` | `20251030000003_create_linkedin_commenting_agent.sql` | YES (post route) | Unknown |
| `linkedin_posts_queue` | `linkedin-commenting-agent-schema.sql` | NO | Unknown |
| `linkedin_comments_sent` | `linkedin-commenting-agent-schema.sql` | NO | Unknown |

### Canonical Tables (ACTIVE - Keep These)

Based on code analysis, these are the **canonical active tables**:

1. **`linkedin_post_monitors`** - Active, 20+ code references
2. **`linkedin_posts_discovered`** - Active, 20+ code references (the MAIN posts table)
3. **`linkedin_comment_queue`** - Active, used in generate/post flows
4. **`linkedin_comments_posted`** - Active, used in post tracking
5. **`linkedin_post_comments`** - Active, used in 4 UI-facing routes
6. **`linkedin_brand_guidelines`** - Partial usage (only in migration 017)

### Deprecated Tables (CAN BE DROPPED)

These tables are **NOT referenced in active code**:

1. **`linkedin_discovered_posts`** - Only in migration 017 and N8N workflow JSON (uses different column names)
2. **`linkedin_posts_queue`** - Only in `linkedin-commenting-agent-schema.sql` (never applied)
3. **`linkedin_comments_sent`** - Only in `linkedin-commenting-agent-schema.sql` (never applied)
4. **`linkedin_comment_campaigns`** - Only in `linkedin-commenting-agent-schema.sql` (never applied)
5. **`linkedin_comment_analytics`** - Only in `linkedin-commenting-agent-schema.sql` (never applied)
6. **`linkedin_profiles_to_monitor`** - Only in migration 017 (different from `linkedin_post_monitors`)

### Why This Happened

Multiple engineers created migrations at different times without consolidating:
- **October 30, 2025:** `20251030000003_create_linkedin_commenting_agent.sql` - First schema
- **November 23, 2025:** `017-linkedin-commenting-complete-system.sql` - Parallel redesign
- **November 23, 2025:** `013-fix-linkedin-commenting-schema.sql` - Another fix attempt
- **Unknown date:** `linkedin-commenting-agent-schema.sql` - Yet another schema (never applied)

---

## 2. Missing RLS DELETE Policies Analysis

### Tables Missing DELETE Policies

| Table | SELECT | INSERT | UPDATE | DELETE | Fix Required |
|-------|--------|--------|--------|--------|--------------|
| `linkedin_posts_discovered` | YES | YES | YES | **NO** | YES |
| `linkedin_comment_queue` | YES | YES | YES | **NO** | YES |
| `linkedin_comments_posted` | YES | YES | YES | **NO** | YES |
| `linkedin_brand_guidelines` | YES | YES | YES | **NO** | YES |
| `linkedin_discovered_posts` | YES | YES | YES | **NO** | DROP TABLE |
| `linkedin_post_monitors` | YES | YES | YES | YES | OK |
| `linkedin_post_comments` | YES | YES | YES | YES | OK |

### Security Implications

Without DELETE policies, users **cannot delete records** even if they have legitimate access. This causes:
1. **Data cleanup issues** - Old posts/comments accumulate
2. **User frustration** - Cannot remove failed/cancelled items
3. **Potential admin workarounds** - Developers may use service role bypassing RLS

### Fix Required

Add DELETE policies to 4 tables (see SQL section below).

---

## 3. linkedin_proxy_assignments RLS Analysis

### Current State

The admin verification route (`/app/api/admin/verify-rls-status/route.ts`) shows this table is **intentionally** kept with RLS disabled:

```typescript
const expectedDisabled = [
  'workspace_accounts',
  'linkedin_proxy_assignments',  // <-- Intentionally disabled
  'user_unipile_accounts'
]
```

### Why RLS is Disabled

Per migration `20250918110000_linkedin_proxy_assignments.sql`:
- Table uses `user_id` column for access control
- Original policy: `user_id = (SELECT id FROM users WHERE clerk_id = auth.uid()::text)`
- After Clerk removal: policy became `user_id = auth.uid()`

**Problem:** The original design expected RLS to work with user-level isolation, but migrations `20251001000000_fix_linkedin_proxy_rls.sql` created new policies.

### Investigation Result

**RLS IS enabled** on this table (per the migration), but the admin check script expects it to be disabled. This is a **configuration mismatch**.

Looking at migration `20251001000000_fix_linkedin_proxy_rls.sql`:
```sql
-- Create new policy using direct Supabase auth
CREATE POLICY "linkedin_proxy_assignments_user_access" ON linkedin_proxy_assignments
    FOR ALL USING (user_id = auth.uid());

-- Also add service role policy for API access
CREATE POLICY "service_role_access_linkedin_proxy_assignments" ON linkedin_proxy_assignments
    FOR ALL USING (auth.role() = 'service_role');
```

### Recommendation

This table **SHOULD have RLS enabled** with the current policies. Update the admin verification script to expect RLS enabled.

---

## 4. Complete Data Flow Analysis

### Data Flow Diagram

```
+-------------------+     +------------------------+     +------------------------+
|  MONITOR CREATION |     |    POST DISCOVERY      |     |   COMMENT GENERATION   |
+-------------------+     +------------------------+     +------------------------+
         |                          |                              |
         v                          v                              v
+-------------------+     +------------------------+     +------------------------+
| linkedin_post_    |     | linkedin_posts_        |     | linkedin_comment_      |
| monitors          | --> | discovered             | --> | queue                  |
| (POST /monitors)  |     | (save-discovered-posts)|     | (generate /generate)   |
+-------------------+     +------------------------+     +------------------------+
                                                                    |
                                                                    v
                                    +------------------------+     +------------------------+
                                    |   APPROVAL WORKFLOW    |     |    COMMENT POSTING     |
                                    +------------------------+     +------------------------+
                                              |                              |
                                              v                              v
                                    +------------------------+     +------------------------+
                                    | linkedin_post_         |     | linkedin_comments_     |
                                    | comments (UI approval) | --> | posted (tracking)      |
                                    | (pending-comments)     |     | (post /post)           |
                                    +------------------------+     +------------------------+
```

### Step-by-Step Flow

#### Step 1: Monitor Creation
- **Route:** `POST /api/linkedin-commenting/monitors`
- **Table:** `linkedin_post_monitors`
- **Fields Written:**
  - `workspace_id` (from user's workspace membership)
  - `created_by` (user.id)
  - `hashtags[]`, `keywords[]`
  - `name`, `status`, `n8n_workflow_id`, `n8n_webhook_url`
  - `timezone`, `daily_start_time`
  - `auto_approve_enabled`, `auto_approve_start_time`, `auto_approve_end_time`

#### Step 2: Post Discovery
- **Route:** `POST /api/linkedin-commenting/save-discovered-posts` (N8N trigger)
- **Table:** `linkedin_posts_discovered`
- **Fields Written:**
  - `workspace_id`, `monitor_id`
  - `post_linkedin_id`, `post_url`, `post_social_id`
  - `author_linkedin_id`, `author_name`, `author_profile_url`, `author_title`, `author_company`
  - `post_text`, `post_type`, `has_media`, `media_urls[]`
  - `posted_at`, `discovered_at`
  - `likes_count`, `comments_count`, `shares_count`
  - `discovered_via_monitor_id`, `monitor_type`, `matched_keywords[]`
  - `status = 'pending'`
  - `metadata` (raw post data)

#### Step 3: Comment Generation
- **Route:** `POST /api/linkedin-commenting/generate` (N8N trigger)
- **Tables:**
  - Reads from: `linkedin_posts_discovered`
  - Writes to: `linkedin_comment_queue`
- **Fields Written to Queue:**
  - `workspace_id`, `post_id`, `post_linkedin_id`, `post_social_id`
  - `comment_text`, `confidence_score`
  - `generation_metadata` (model, tokens, reasoning)
  - `approval_status = 'pending'` or `'auto_approved'`
  - `requires_approval` (based on confidence < 0.80)
  - `status = 'queued'`

#### Step 4: Approval Workflow (UI)
- **Route:** `GET /api/linkedin-commenting/pending-comments`
- **Tables:** Joins `linkedin_post_comments` with `linkedin_posts_discovered` and `linkedin_post_monitors`

**Issue Found:** There are TWO parallel approval tables:
- `linkedin_comment_queue` - Used by N8N flow
- `linkedin_post_comments` - Used by UI

#### Step 5: Comment Posting
- **Route:** `POST /api/linkedin-commenting/post` (N8N trigger)
- **Tables:**
  - Reads from: `linkedin_comment_queue`
  - Updates: `linkedin_comment_queue` (status = 'posted')
  - Writes to: `linkedin_comments_posted`
  - Updates: `linkedin_posts_discovered` (status = 'commented')
- **Fields Written to Posted:**
  - `workspace_id`, `comment_queue_id`, `post_id`
  - `post_linkedin_id`, `comment_linkedin_id`
  - `comment_text`, `posted_by_account_id`
  - `is_comment_reply`, `replied_to_comment_id`, `replied_to_author_name`
  - `metadata` (confidence, approval, generation info)

---

## 5. Schema Inconsistencies

### Column Naming Issues

| Concept | Migration 013/030 | Migration 017 | Code Expectation |
|---------|------------------|---------------|------------------|
| Post ID | `post_linkedin_id` | `social_id` | `post_linkedin_id` |
| Post URL | `post_url` | `post_url` | `share_url` (some routes) |
| Author | `author_linkedin_id` | N/A | `author_profile_id` (some routes) |
| Content | `post_text` | `post_text` | `post_content` (some routes) |
| Monitor FK | `discovered_via_monitor_id` | `profile_id` | `monitor_id` |
| Status | `status` | `comment_status` | Mixed |

### FK Relationship Issues

1. **`linkedin_posts_discovered.monitor_id`** references `linkedin_post_monitors.id` but uses `ON DELETE SET NULL`
2. **`linkedin_post_comments.monitor_id`** uses different FK name: `linkedin_post_comments_monitor_id_fkey`
3. **`linkedin_discovered_posts.profile_id`** references `linkedin_profiles_to_monitor.id` (a table that may not exist)

### Index Naming Inconsistencies

- `idx_posts_workspace` vs `idx_posts_discovered_workspace`
- `idx_linkedin_posts_status` vs `idx_posts_discovered_status`

---

## 6. Recommendations and Fixes

### Immediate Actions (P0)

#### 6.1 Add Missing DELETE Policies

```sql
-- Migration: Add missing DELETE policies to LinkedIn Commenting tables
-- Date: November 27, 2025

-- 1. linkedin_posts_discovered DELETE policy
CREATE POLICY IF NOT EXISTS "posts_discovered_workspace_delete"
  ON linkedin_posts_discovered
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_posts_discovered.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- 2. linkedin_comment_queue DELETE policy
CREATE POLICY IF NOT EXISTS "comment_queue_workspace_delete"
  ON linkedin_comment_queue
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_comment_queue.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- 3. linkedin_comments_posted DELETE policy
CREATE POLICY IF NOT EXISTS "comments_posted_workspace_delete"
  ON linkedin_comments_posted
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_comments_posted.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- 4. linkedin_brand_guidelines DELETE policy
CREATE POLICY IF NOT EXISTS "brand_guidelines_workspace_delete"
  ON linkedin_brand_guidelines
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_brand_guidelines.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );
```

#### 6.2 Fix Admin RLS Verification Script

Update `/app/api/admin/verify-rls-status/route.ts`:

```typescript
// CHANGE:
const expectedDisabled = [
  'workspace_accounts',
  'linkedin_proxy_assignments',  // REMOVE THIS
  'user_unipile_accounts'
]

// TO:
const expectedEnabled = [
  'workspaces',
  'workspace_members',
  'campaigns',
  'campaign_prospects',
  'prospect_approval_sessions',
  'linkedin_proxy_assignments',  // ADD THIS
  'linkedin_posts_discovered',
  'linkedin_post_monitors',
  'linkedin_comment_queue',
  'linkedin_comments_posted'
]
```

### Short-Term Actions (P1)

#### 6.3 Drop Deprecated Tables

```sql
-- CAUTION: Verify these tables have no data before dropping
-- Run in staging first!

-- Check row counts first
SELECT 'linkedin_discovered_posts' as table_name, COUNT(*) FROM linkedin_discovered_posts
UNION ALL
SELECT 'linkedin_profiles_to_monitor', COUNT(*) FROM linkedin_profiles_to_monitor;

-- If 0 rows, safe to drop
DROP TABLE IF EXISTS linkedin_discovered_posts CASCADE;
DROP TABLE IF EXISTS linkedin_profiles_to_monitor CASCADE;

-- Note: linkedin_posts_queue, linkedin_comments_sent, linkedin_comment_campaigns,
-- linkedin_comment_analytics were never created (only in schema file, not applied)
```

#### 6.4 Consolidate Approval Tables

The codebase has TWO approval workflows:
1. `linkedin_comment_queue` (N8N flow, high confidence auto-approve)
2. `linkedin_post_comments` (UI approval flow)

**Decision Required:** Keep one, migrate data from the other. I recommend keeping `linkedin_comment_queue` as it has more complete fields.

### Medium-Term Actions (P2)

#### 6.5 Standardize Column Names

Create a view to provide consistent naming:

```sql
CREATE OR REPLACE VIEW linkedin_posts_unified AS
SELECT
  id,
  workspace_id,
  monitor_id,
  post_linkedin_id AS social_id,
  post_url AS share_url,
  post_social_id,
  author_linkedin_id AS author_profile_id,
  author_name,
  author_profile_url,
  author_title,
  author_company,
  post_text AS post_content,
  post_type,
  has_media,
  media_urls,
  posted_at AS post_date,
  discovered_at,
  likes_count,
  comments_count,
  shares_count,
  discovered_via_monitor_id,
  monitor_type,
  matched_keywords,
  status,
  skip_reason,
  metadata,
  created_at,
  updated_at
FROM linkedin_posts_discovered;
```

#### 6.6 Update N8N Workflow JSON

The N8N workflow `linkedin-commenting-supabase-unipile.json` uses `linkedin_discovered_posts` table. Update to use `linkedin_posts_discovered` instead.

---

## 7. Files Analyzed

### API Routes (20 files)
- `/app/api/linkedin-commenting/monitors/route.ts`
- `/app/api/linkedin-commenting/save-discovered-posts/route.ts`
- `/app/api/linkedin-commenting/generate/route.ts`
- `/app/api/linkedin-commenting/post/route.ts`
- `/app/api/linkedin-commenting/pending-comments/route.ts`
- `/app/api/linkedin-commenting/approve-comment/route.ts`
- `/app/api/linkedin-commenting/reject-comment/route.ts`
- `/app/api/linkedin-commenting/get-discovered-posts/route.ts`
- `/app/api/linkedin-commenting/generate-comment-ui/route.ts`
- `/app/api/linkedin-commenting/auto-generate-comments/route.ts`
- `/app/api/linkedin-commenting/discover-posts-apify/route.ts`
- `/app/api/linkedin-commenting/discover-profile-posts/route.ts`
- `/app/api/linkedin-commenting/pending-posts/route.ts`
- `/app/api/linkedin-commenting/mark-processed/route.ts`
- `/app/api/linkedin-commenting/auto-approve/route.ts`
- `/app/api/linkedin-commenting/ready-to-post/route.ts`
- `/app/api/linkedin-commenting/rate-limit-check/route.ts`
- `/app/api/linkedin-commenting/save-comment/route.ts`
- `/app/api/linkedin-commenting/test-unipile/route.ts`
- `/app/api/linkedin-commenting/test-discover/route.ts`

### Migrations (8 files)
- `/supabase/migrations/20251030000003_create_linkedin_commenting_agent.sql`
- `/sql/migrations/013-fix-linkedin-commenting-schema.sql`
- `/sql/migrations/017-linkedin-commenting-complete-system.sql`
- `/sql/migrations/018-create-linkedin-post-comments-table.sql`
- `/sql/migrations/20251125_fix_linkedin_commenting_schema.sql`
- `/sql/migrations/20251123_create_linkedin_commenting_tables.sql`
- `/sql/migrations/linkedin_commenting_clean.sql`
- `/sql/linkedin-commenting-agent-schema.sql` (not applied)

### Proxy Assignments (3 files)
- `/supabase/migrations/20250918110000_linkedin_proxy_assignments.sql`
- `/supabase/migrations/20251001000000_fix_linkedin_proxy_rls.sql`
- `/app/api/linkedin/assign-proxy-ips/route.ts`

### N8N Workflows (1 file)
- `/n8n-workflows/linkedin-commenting-supabase-unipile.json`

---

## 8. Next Steps

1. **Create migration file** with DELETE policies (copy SQL from section 6.1)
2. **Run migration in staging** and verify
3. **Update admin verification script** (section 6.2)
4. **Test all commenting agent routes** after migration
5. **Plan table consolidation** for P1 items
6. **Update N8N workflow** to use correct table names

---

## Appendix: Complete Table Schema Comparison

### linkedin_posts_discovered (CANONICAL)

| Column | Type | From Migration |
|--------|------|----------------|
| id | UUID | 013 |
| workspace_id | UUID | 013 |
| monitor_id | UUID | 013 |
| social_id | VARCHAR(255) | 013 |
| share_url | TEXT | 013 |
| post_content | TEXT | 013 |
| author_name | VARCHAR(255) | 013 |
| author_profile_id | VARCHAR(255) | 013 |
| author_headline | TEXT | 013 |
| hashtags | TEXT[] | 013 |
| post_date | TIMESTAMP | 013 |
| engagement_metrics | JSONB | 013 |
| status | VARCHAR(50) | 013 |
| skip_reason | TEXT | 013 |
| created_at | TIMESTAMP | 013 |
| updated_at | TIMESTAMP | 013 |

### linkedin_discovered_posts (DEPRECATED)

| Column | Type | From Migration |
|--------|------|----------------|
| id | UUID | 017 |
| workspace_id | UUID | 017 |
| profile_id | UUID | 017 (references linkedin_profiles_to_monitor) |
| social_id | VARCHAR(255) | 017 |
| post_url | TEXT | 017 |
| post_text | TEXT | 017 |
| author_name | VARCHAR(255) | 017 |
| author_headline | TEXT | 017 |
| posted_date | VARCHAR(50) | 017 |
| comment_count | INTEGER | 017 |
| reaction_count | INTEGER | 017 |
| ai_comment | TEXT | 017 |
| comment_status | VARCHAR(50) | 017 |
| commented_at | TIMESTAMP | 017 |
| created_at | TIMESTAMP | 017 |
| updated_at | TIMESTAMP | 017 |

Note the different column names and foreign key relationships.
