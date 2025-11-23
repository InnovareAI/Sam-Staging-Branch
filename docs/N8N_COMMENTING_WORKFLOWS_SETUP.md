# N8N LinkedIn Commenting Workflows Setup Guide

**Date:** November 23, 2025

## Overview

The LinkedIn Commenting Agent requires 3 N8N workflows that work together to discover posts, generate comments, and post them to LinkedIn.

## Workflow 1: Post Discovery (Run every 30 minutes)

**Name:** LinkedIn Commenting - Post Discovery

**Trigger:** Schedule - Every 30 minutes

**Steps:**

### 1. Fetch Active Monitors
- **Node:** Supabase - Query
- **Table:** `linkedin_post_monitors`
- **Query:**
  ```sql
  SELECT * FROM linkedin_post_monitors WHERE status = 'active'
  ```

### 2. Loop Through Each Monitor
- **Node:** Loop Over Items

### 3. Search LinkedIn Posts
- **Node:** HTTP Request - Unipile API
- **Method:** POST
- **URL:** `https://api6.unipile.com:13670/api/v1/posts/search`
- **Headers:**
  - `X-API-KEY`: Unipile API key
  - `Content-Type`: application/json
- **Body:**
  ```json
  {
    "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
    "hashtags": "{{ $json.hashtags }}",
    "limit": 20
  }
  ```

### 4. Filter Out Already Discovered Posts
- **Node:** Code (JavaScript)
- **Purpose:** Check if post `social_id` already exists in `linkedin_posts_discovered` table

### 5. Store Discovered Posts
- **Node:** Supabase - Insert
- **Table:** `linkedin_posts_discovered`
- **Columns:**
  - `workspace_id`: From monitor
  - `monitor_id`: Monitor ID
  - `social_id`: LinkedIn post ID
  - `share_url`: Post URL
  - `post_content`: Post text
  - `author_name`: Author's name
  - `author_profile_id`: Author's LinkedIn ID
  - `hashtags`: Array of hashtags
  - `post_date`: Post timestamp
  - `status`: 'discovered'

---

## Workflow 2: Comment Generator (Run every 15 minutes)

**Name:** LinkedIn Commenting - Comment Generator

**Trigger:** Schedule - Every 15 minutes

**Steps:**

### 1. Fetch Discovered Posts Needing Comments
- **Node:** Supabase - Query
- **Table:** `linkedin_posts_discovered`
- **Query:**
  ```sql
  SELECT * FROM linkedin_posts_discovered
  WHERE status = 'discovered'
  LIMIT 10
  ```

### 2. Get Monitor Settings
- **Node:** Supabase - Query
- **Table:** `linkedin_post_monitors`
- **Query:**
  ```sql
  SELECT * FROM linkedin_post_monitors WHERE id = '{{ $json.monitor_id }}'
  ```

### 3. Generate AI Comment
- **Node:** HTTP Request - OpenRouter/Claude
- **Method:** POST
- **URL:** `https://openrouter.ai/api/v1/chat/completions`
- **Headers:**
  - `Authorization`: Bearer YOUR_OPENROUTER_KEY
  - `Content-Type`: application/json
- **Body:**
  ```json
  {
    "model": "anthropic/claude-3.5-sonnet",
    "messages": [
      {
        "role": "system",
        "content": "Generate a professional, engaging LinkedIn comment for this post. Keep it concise (50-150 words), authentic, and add value to the conversation."
      },
      {
        "role": "user",
        "content": "Post: {{ $json.post_content }}\n\nGenerate a thoughtful comment."
      }
    ]
  }
  ```

### 4. Store Generated Comment in Queue
- **Node:** Supabase - Insert
- **Table:** `linkedin_comment_queue`
- **Columns:**
  - `workspace_id`: From post
  - `post_id`: Post UUID
  - `post_social_id`: LinkedIn post ID
  - `comment_text`: Generated comment
  - `comment_length`: Length of comment
  - `requires_approval`: true
  - `status`: 'pending'
  - `generated_by`: 'claude'
  - `generation_model`: 'claude-3.5-sonnet'

### 5. Check Auto-Approval
- **Node:** HTTP Request - Your API
- **Method:** POST
- **URL:** `https://app.meet-sam.com/api/linkedin-commenting/auto-approve`
- **Body:**
  ```json
  {
    "monitorId": "{{ $json.monitor_id }}",
    "queueId": "{{ $json.queue_id }}"
  }
  ```

### 6. Update Post Status
- **Node:** Supabase - Update
- **Table:** `linkedin_posts_discovered`
- **Set:** `status = 'processing'`
- **Where:** `id = '{{ $json.id }}'`

---

## Workflow 3: Comment Poster (Run every 10 minutes)

**Name:** LinkedIn Commenting - Comment Poster

**Trigger:** Schedule - Every 10 minutes

**Steps:**

### 1. Fetch Approved Comments
- **Node:** Supabase - Query
- **Table:** `linkedin_comment_queue`
- **Query:**
  ```sql
  SELECT * FROM linkedin_comment_queue
  WHERE status = 'approved' AND posted_at IS NULL
  LIMIT 5
  ```

### 2. Post Comment to LinkedIn
- **Node:** HTTP Request - Unipile API
- **Method:** POST
- **URL:** `https://api6.unipile.com:13670/api/v1/chats/message`
- **Headers:**
  - `X-API-KEY`: Unipile API key
  - `Content-Type`: application/json
- **Body:**
  ```json
  {
    "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
    "chat_id": "{{ $json.post_social_id }}",
    "text": "{{ $json.comment_text }}",
    "type": "COMMENT"
  }
  ```

### 3. Store Posted Comment
- **Node:** Supabase - Insert
- **Table:** `linkedin_comments_posted`
- **Columns:**
  - `workspace_id`: From queue item
  - `post_id`: Post UUID
  - `queue_id`: Queue item UUID
  - `comment_id`: LinkedIn comment ID (from response)
  - `post_social_id`: LinkedIn post ID
  - `comment_text`: Comment text
  - `posted_at`: NOW()

### 4. Update Queue Status
- **Node:** Supabase - Update
- **Table:** `linkedin_comment_queue`
- **Set:**
  - `status = 'posted'`
  - `posted_at = NOW()`
- **Where:** `id = '{{ $json.id }}'`

### 5. Update Post Status
- **Node:** Supabase - Update
- **Table:** `linkedin_posts_discovered`
- **Set:** `status = 'commented'`
- **Where:** `id = '{{ $json.post_id }}'`

---

## Environment Variables Needed in N8N

Add these to your N8N Docker environment:

```bash
SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_ANON_KEY=your_anon_key
UNIPILE_API_KEY=39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_ACCOUNT_ID=ymtTx4xVQ6OVUFk83ctwtA
OPENROUTER_API_KEY=your_openrouter_key
APP_URL=https://app.meet-sam.com
```

---

## Testing the Workflows

### 1. Create a Test Monitor
Use the UI to create a commenting campaign with hashtag `#test` or `#ai`

### 2. Manually Trigger Discovery Workflow
Should find posts with those hashtags and store them in `linkedin_posts_discovered`

### 3. Check Database
```sql
SELECT * FROM linkedin_posts_discovered WHERE status = 'discovered';
```

### 4. Manually Trigger Generator Workflow
Should generate comments and store in `linkedin_comment_queue`

### 5. Check Queue
```sql
SELECT * FROM linkedin_comment_queue WHERE status = 'pending';
```

### 6. Manually Approve a Comment (for testing)
```sql
UPDATE linkedin_comment_queue
SET status = 'approved', approval_status = 'approved'
WHERE id = 'queue_id_here';
```

### 7. Manually Trigger Poster Workflow
Should post the comment to LinkedIn

### 8. Verify on LinkedIn
Check the actual LinkedIn post to see if your comment appeared

---

## Monitoring & Debugging

### Check Workflow Execution Logs
- N8N Dashboard → Executions
- Look for errors in each step

### Database Queries for Monitoring

**Active Monitors:**
```sql
SELECT * FROM linkedin_post_monitors WHERE status = 'active';
```

**Recent Discovered Posts:**
```sql
SELECT * FROM linkedin_posts_discovered
ORDER BY created_at DESC
LIMIT 20;
```

**Pending Approvals:**
```sql
SELECT * FROM linkedin_comment_queue
WHERE status = 'pending'
ORDER BY created_at DESC;
```

**Posted Comments:**
```sql
SELECT * FROM linkedin_comments_posted
ORDER BY posted_at DESC
LIMIT 20;
```

---

## Important Notes

1. **Rate Limiting**: LinkedIn may flag accounts that comment too frequently. Start with a low daily limit (10-15 comments/day).

2. **Auto-Approval**: Only works during the configured approval window (e.g., 9 AM - 5 PM in your timezone).

3. **Quality Control**: Monitor the first 10-20 generated comments manually to ensure quality before enabling auto-approval.

4. **Error Handling**: If a workflow fails, N8N will retry automatically. Check execution logs for details.

5. **Schema Validation**: The workflows expect the new simplified schema (hashtags/keywords arrays, not monitor_type/target_value).

---

## Next Steps

1. Set up the 3 workflows in N8N using the visual editor
2. Add the environment variables to your N8N Docker container
3. Create a test monitor with hashtag `#ai` or `#technology`
4. Manually trigger each workflow to test the flow
5. Verify comments are being generated and posted correctly
6. Enable auto-approval for your business hours
7. Monitor for a week before scaling up

