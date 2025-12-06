# Rule 3: Comment on High-Quality Comments

## Overview

Instead of always commenting directly on posts, SAM should sometimes reply to existing high-quality comments on those posts. This creates more natural engagement and can lead to better conversations.

## User Story

> As a SAM user, I want SAM to reply to thoughtful comments on posts (not just the post itself) so my engagement looks more natural and conversational.

---

## How It Works

### Current Flow
```
Post Discovered → Generate Comment on Post → Approve → Post Comment
```

### New Flow
```
Post Discovered → Fetch Existing Comments →
  IF high-quality comment exists:
    → Generate Reply to Comment
  ELSE:
    → Generate Comment on Post (existing behavior)
```

---

## Technical Implementation

### 1. Fetch Comments on Post

**Unipile API Endpoint:**
```
GET /api/v1/posts/{social_id}/comments?account_id={account_id}&limit=10
```

**Response Example:**
```json
{
  "items": [
    {
      "id": "comment_abc123",
      "text": "Great insights! I've been thinking about this...",
      "author": {
        "name": "Jane Smith",
        "public_identifier": "jane-smith-123"
      },
      "reactions_count": 12,
      "replies_count": 3,
      "created_at": "2025-12-06T08:00:00Z"
    }
  ]
}
```

### 2. Quality Scoring

Score each comment (0-100) based on:

| Factor | Weight | Criteria |
|--------|--------|----------|
| Reactions | 30% | 5+ reactions = high, 10+ = very high |
| Length | 25% | 50-200 chars = good, thoughtful content |
| Replies | 20% | Has replies = engaging discussion |
| Relevance | 25% | Matches our expertise areas |

**Threshold:** Only reply to comments with score >= 60

### 3. AI Prompt for Reply

```markdown
You are replying to a comment on a LinkedIn post.

POST CONTEXT:
{original_post_text}

COMMENT YOU'RE REPLYING TO:
Author: {comment_author_name}
Text: "{comment_text}"

YOUR TASK:
Write a thoughtful reply that:
1. Acknowledges their point
2. Adds value from your expertise
3. Keeps it conversational (2-3 sentences)
4. Does NOT pitch or sell anything

TONE: {workspace_tone_of_voice}
```

### 4. Database Changes

Add to `linkedin_post_comments` table:
```sql
ALTER TABLE linkedin_post_comments
ADD COLUMN IF NOT EXISTS reply_to_comment_id TEXT,
ADD COLUMN IF NOT EXISTS is_reply_to_comment BOOLEAN DEFAULT FALSE;
```

### 5. Post Reply via Unipile

**Endpoint:**
```
POST /api/v1/posts/{post_id}/comments
```

**Body:**
```json
{
  "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
  "text": "Great point Jane! In my experience...",
  "parent_comment_id": "comment_abc123"  // This makes it a reply
}
```

---

## Decision Matrix

| Scenario | Action |
|----------|--------|
| Post has 0 comments | Comment on post (existing) |
| Post has comments, none quality | Comment on post (existing) |
| Post has 1 quality comment | Reply to that comment |
| Post has 2+ quality comments | Reply to highest-scored comment |
| We already replied to that author | Skip (deduplication) |

---

## Implementation Phases

### Phase 1: Basic (4-6 hours)
- [ ] Add `fetchPostComments()` function using Unipile API
- [ ] Add quality scoring logic
- [ ] Update auto-generate-comments to check for quality comments
- [ ] Add `is_reply_to_comment` field to database

### Phase 2: AI Prompt (2-3 hours)
- [ ] Create `generateCommentReply()` function with specialized prompt
- [ ] Test reply generation quality

### Phase 3: Posting (2-3 hours)
- [ ] Update comment posting to use `parent_comment_id` for replies
- [ ] Test end-to-end flow

### Phase 4: Polish (2 hours)
- [ ] Add logging and metrics
- [ ] Update digest email to show "Reply to [Author]"
- [ ] Handle edge cases

**Total Estimate:** 10-14 hours

---

## Configuration Options

Add to `linkedin_post_monitors`:
```sql
ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS reply_to_comments_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS min_comment_quality_score INT DEFAULT 60;
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Reply looks spammy | Quality threshold + thoughtful AI prompt |
| Author dedup fails | Track comment authors like post authors |
| Unipile rate limits | 5-second delay between API calls |
| Comment deleted before reply | Graceful error handling |

---

## Success Metrics

- Reply engagement rate (likes/replies on our replies)
- Conversation continuation rate
- User feedback (good/bad ratings)

---

## Open Questions

1. Should we prefer replies over direct comments? Or 50/50 split?
2. What's the minimum reactions threshold? (Currently: 5)
3. Should we reply to comments from connections vs non-connections differently?

---

## Approval

- [ ] Product approval for feature
- [ ] Review quality scoring criteria
- [ ] Confirm Unipile API supports comment replies

---

*Last Updated: December 6, 2025*
