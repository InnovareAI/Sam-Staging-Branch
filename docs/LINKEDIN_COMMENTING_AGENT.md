# LinkedIn Commenting Agent - Complete Technical Documentation

**Last Updated:** December 16, 2025
**Status:** Production - Fully Operational
**Total Codebase:** 10,000+ lines across 60+ files

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Services](#core-services)
4. [API Endpoints](#api-endpoints)
5. [Scheduled Functions (Cron Jobs)](#scheduled-functions-cron-jobs)
6. [Database Schema](#database-schema)
7. [Anti-Detection System](#anti-detection-system)
8. [Brand Guidelines](#brand-guidelines)
9. [Quality Scoring System](#quality-scoring-system)
10. [Performance Tracking](#performance-tracking)
11. [Author Relationship Memory](#author-relationship-memory)
12. [UI Components](#ui-components)
13. [Configuration](#configuration)
14. [Troubleshooting](#troubleshooting)

---

## Overview

The LinkedIn Commenting Agent is an AI-powered system that automatically discovers LinkedIn posts, generates contextual comments, and posts them on behalf of users. It's designed to build authentic engagement while maintaining strict anti-detection measures.

### Key Features

- **AI Comment Generation** - Claude Haiku 4.5 generates human-like comments
- **Post Discovery** - Monitors profiles and hashtags for new content
- **Quality Scoring** - Prioritizes high-engagement posts (0-100 score)
- **Performance Tracking** - Learns what comment styles work best
- **Author Relationship Memory** - Tracks all interactions over time
- **Anti-Detection** - Randomized timing, lengths, and comment types
- **Human-in-the-Loop** - Approval workflow before posting
- **Multi-Tenant** - Workspace-isolated with Supabase RLS

### System Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     LINKEDIN COMMENTING AGENT FLOW                       │
└─────────────────────────────────────────────────────────────────────────┘

1. DISCOVERY (Every 2-4 hours)
   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │   Profile    │     │   Hashtag    │     │   Company    │
   │   Monitors   │     │   Monitors   │     │   Monitors   │
   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               ▼
                    ┌──────────────────┐
                    │  linkedin_posts  │
                    │   _discovered    │
                    └────────┬─────────┘
                             │
2. QUALITY SCORING           ▼
                    ┌──────────────────┐
                    │ Engagement Score │ ← 0-100 based on reactions,
                    │ Quality Filter   │   comments, recency, author
                    └────────┬─────────┘
                             │
3. RELATIONSHIP CHECK        ▼
                    ┌──────────────────┐
                    │ Author History   │ ← 5-day cooldown per author
                    │ Topics Discussed │   Avoid repetition
                    └────────┬─────────┘
                             │
4. AI GENERATION (Every 30 min)
                             ▼
                    ┌──────────────────┐
                    │ Claude Haiku 4.5 │ ← Brand guidelines + variance
                    │ + Anti-Detection │   Random length/type
                    └────────┬─────────┘
                             │
5. APPROVAL                  ▼
                    ┌──────────────────┐
                    │   HITL Review    │ ← User approves/rejects/edits
                    │   or Auto-Approve│
                    └────────┬─────────┘
                             │
6. POSTING (Every 45 min)    ▼
                    ┌──────────────────┐
                    │  Unipile API     │ ← Posts to LinkedIn
                    │  Rate Limited    │   1 per 30 min spacing
                    └────────┬─────────┘
                             │
7. PERFORMANCE TRACKING      ▼
                    ┌──────────────────┐
                    │ Track reactions  │ ← Every 6 hours
                    │ Track replies    │   Update relationship scores
                    └──────────────────┘
```

---

## Architecture

### Directory Structure

```
/app
├── api/linkedin-commenting/          # 45+ API endpoints
│   ├── generate/                     # Comment generation
│   ├── monitors/                     # Monitor management
│   ├── comments/                     # Comment CRUD
│   ├── settings/                     # Workspace settings
│   └── analytics/                    # Performance analytics
├── workspace/[workspaceId]/commenting-agent/
│   ├── page.tsx                      # Main dashboard
│   ├── approve/page.tsx              # Approval workflow
│   ├── profiles/page.tsx             # Monitor management
│   ├── my-posts/page.tsx             # Self-post monitoring
│   └── analytics/page.tsx            # Analytics dashboard
└── components/
    ├── CommentingAgentModal.tsx      # Configuration modal
    ├── CommentingAgentSettings.tsx   # Brand guidelines UI
    ├── CommentingCampaignModal.tsx   # Campaign management
    └── CommentApprovalWorkflow.tsx   # Approval interface

/lib/services/
├── linkedin-commenting-agent.ts      # Main generation engine (1,136 lines)
├── engagement-quality-scorer.ts      # Post quality scoring (233 lines)
├── comment-performance-tracker.ts    # Performance analytics (422 lines)
├── author-relationship-tracker.ts    # Relationship memory (429 lines)
└── linkedin-comment-replies.ts       # Reply logic (252 lines)

/lib/anti-detection/
└── comment-variance.ts               # Randomization system

/netlify/functions/
├── auto-generate-comments.ts         # Every 30 min
├── process-comment-queue.ts          # Every 45 min
├── discover-posts.ts                 # Every 2 hours (profiles)
├── discover-posts-brightdata.ts      # Every 4 hours (hashtags)
├── commenting-digest.ts              # Daily digest email
└── track-comment-performance.ts      # Every 6 hours

/sql/migrations/
├── 017-linkedin-commenting-complete-system.sql
├── 018-create-linkedin-post-comments-table.sql
├── 021-linkedin-commenting-full-settings.sql
├── 022-create-linkedin-comment-replies-table.sql
└── 052-commenting-agent-improvements.sql
```

### Technology Stack

| Component | Technology |
|-----------|------------|
| AI Model | Claude Haiku 4.5 (via OpenRouter) |
| Database | Supabase PostgreSQL with RLS |
| LinkedIn API | Unipile REST API |
| Scheduling | Netlify Scheduled Functions |
| Frontend | Next.js 15 + React 18 |
| Email | Postmark (digest emails) |

---

## Core Services

### 1. linkedin-commenting-agent.ts

**Location:** `/lib/services/linkedin-commenting-agent.ts`
**Lines:** 1,136
**Purpose:** Main comment generation engine

#### Key Functions

```typescript
// Generate a single comment for a post
async function generateLinkedInComment(
  post: LinkedInPost,
  brandGuidelines: BrandGuidelines,
  workspaceContext: WorkspaceContext,
  prospectContext?: ProspectContext
): Promise<GeneratedComment>

// Generate reply to existing comment
async function generateCommentReply(
  originalComment: string,
  post: LinkedInPost,
  brandGuidelines: BrandGuidelines
): Promise<string>

// Batch process multiple posts
async function batchGenerateComments(
  posts: LinkedInPost[],
  brandGuidelines: BrandGuidelines,
  maxConcurrent: number = 3
): Promise<GeneratedComment[]>

// Validate comment quality before posting
function validateCommentQuality(comment: string): {
  isValid: boolean;
  issues: string[];
}

// Determine if post should be skipped
function shouldSkipPost(post: LinkedInPost): {
  skip: boolean;
  reason?: string;
}
```

#### AI Prompt Structure

```typescript
const systemPrompt = `You are ${workspaceContext.companyName}'s LinkedIn voice.

BRAND GUIDELINES:
- Tone: ${brandGuidelines.tone}
- Formality: ${brandGuidelines.formality}
- Expertise: ${brandGuidelines.expertise}

COMMENT FRAMEWORK: ${brandGuidelines.framework}

RULES:
1. ${varianceConfig.lengthCategory} length (${lengthRange} characters)
2. ${varianceConfig.commentType} style comment
3. Never use banned phrases: "Great post!", "Love this!", etc.
4. Sound authentically human, not AI-generated
5. Add genuine value to the conversation

${relationshipContext ? `
RELATIONSHIP CONTEXT:
- Prior interactions: ${relationshipContext.totalComments}
- Topics to avoid: ${relationshipContext.topicsToAvoid.join(', ')}
- Approach: ${relationshipContext.suggestedApproach}
` : ''}`;
```

#### Banned Phrases Detection

```typescript
const BANNED_PHRASES = [
  'great post',
  'love this',
  'thanks for sharing',
  'couldn\'t agree more',
  'this is so true',
  'well said',
  'absolutely',
  'totally agree',
  'spot on',
  'nailed it',
  // ... 50+ more generic AI phrases
];

function containsBannedPhrase(comment: string): boolean {
  const lowerComment = comment.toLowerCase();
  return BANNED_PHRASES.some(phrase =>
    lowerComment.includes(phrase.toLowerCase())
  );
}
```

### 2. engagement-quality-scorer.ts

**Location:** `/lib/services/engagement-quality-scorer.ts`
**Lines:** 233
**Purpose:** Score posts 0-100 to prioritize commenting

#### Scoring Algorithm

```typescript
interface QualityScore {
  total_score: number;        // 0-100
  factors: {
    engagement_score: number;  // 0-30 points
    discussion_score: number;  // 0-25 points
    recency_score: number;     // 0-20 points
    content_depth_score: number; // 0-15 points
    author_quality_score: number; // 0-10 points
  };
  recommendation: 'high_priority' | 'normal' | 'low_priority' | 'skip';
}

// Engagement Score (0-30 points)
function calculateEngagementScore(metrics: EngagementMetrics): number {
  const reactions = metrics.reactions || 0;
  const comments = metrics.comments || 0;

  // Logarithmic scaling to prevent viral posts from dominating
  const reactionScore = Math.min(15, Math.log10(reactions + 1) * 5);
  const commentScore = Math.min(15, Math.log10(comments + 1) * 7);

  return Math.round(reactionScore + commentScore);
}

// Discussion Score (0-25 points)
function calculateDiscussionScore(metrics: EngagementMetrics): number {
  const reactions = metrics.reactions || 1;
  const comments = metrics.comments || 0;

  // Higher comment-to-reaction ratio = better discussion
  const ratio = comments / reactions;
  return Math.min(25, Math.round(ratio * 50));
}

// Recency Score (0-20 points)
function calculateRecencyScore(postDate: string): number {
  const hoursAgo = (Date.now() - new Date(postDate).getTime()) / (1000 * 60 * 60);

  if (hoursAgo < 2) return 20;      // Fresh: full points
  if (hoursAgo < 6) return 18;      // Recent: high points
  if (hoursAgo < 12) return 15;     // Same day: good points
  if (hoursAgo < 24) return 12;     // Yesterday: moderate
  if (hoursAgo < 48) return 8;      // 2 days: low
  if (hoursAgo < 72) return 4;      // 3 days: minimal
  return 0;                          // Older: no points
}

// Recommendations
function getRecommendation(score: number): string {
  if (score >= 70) return 'high_priority';
  if (score >= 45) return 'normal';
  if (score >= 25) return 'low_priority';
  return 'skip';
}
```

### 3. comment-performance-tracker.ts

**Location:** `/lib/services/comment-performance-tracker.ts`
**Lines:** 422
**Purpose:** Track engagement on our posted comments

#### Key Functions

```typescript
// Check engagement on a single comment
async function checkCommentEngagement(
  commentLinkedInId: string,
  postLinkedInId: string,
  accountId: string,
  originalPostAuthorId?: string
): Promise<CommentPerformance | null>

// Update comment record with performance data
async function updateCommentPerformance(
  supabase: SupabaseClient,
  commentId: string,
  performance: CommentPerformance
): Promise<boolean>

// Check all recent comments for a workspace
async function checkRecentCommentsPerformance(
  supabase: SupabaseClient,
  workspaceId: string,
  accountId: string,
  daysBack: number = 7
): Promise<{ checked: number; updated: number }>

// Aggregate weekly statistics
async function aggregatePerformanceStats(
  supabase: SupabaseClient,
  workspaceId: string,
  daysBack: number = 7
): Promise<PerformanceStats | null>
```

#### Performance Metrics

```typescript
interface CommentPerformance {
  reactions_count: number;
  replies_count: number;
  author_replied: boolean;    // Did post author respond?
  author_liked: boolean;      // Did post author like?
  performance_score: number;  // 0-100 calculated score
}

// Performance score calculation
function calculatePerformanceScore(perf: CommentPerformance): number {
  let score = 0;

  // Reactions (max 40 points)
  score += Math.min(40, perf.reactions_count * 4);

  // Replies (max 30 points)
  score += Math.min(30, perf.replies_count * 10);

  // Author engagement (bonus 30 points)
  if (perf.author_replied) score += 20;
  if (perf.author_liked) score += 10;

  return Math.min(100, score);
}
```

### 4. author-relationship-tracker.ts

**Location:** `/lib/services/author-relationship-tracker.ts`
**Lines:** 429
**Purpose:** Track all interactions with LinkedIn authors

#### Relationship Strength Levels

```typescript
type RelationshipStrength = 'new' | 'engaged' | 'responsive' | 'advocate';

// Progression:
// - new: < 3 total comments on their posts
// - engaged: 3+ comments, no responses from them
// - responsive: author has replied at least once
// - advocate: author has replied 3+ times
```

#### Key Functions

```typescript
// Get context before commenting on an author's post
async function getAuthorRelationshipContext(
  supabase: SupabaseClient,
  workspaceId: string,
  authorProfileId: string,
  authorName?: string
): Promise<RelationshipContext>

interface RelationshipContext {
  exists: boolean;
  relationship?: AuthorRelationship;
  recommendation: 'comment' | 'skip_cooldown' | 'high_priority';
  reason: string;
  suggested_approach?: string;
  topics_to_avoid?: string[];
}

// Record a new interaction
async function recordAuthorInteraction(
  supabase: SupabaseClient,
  workspaceId: string,
  authorProfileId: string,
  interaction: {
    author_name?: string;
    author_headline?: string;
    topic?: string;
    comment_id: string;
  }
): Promise<boolean>

// Update when author responds to us
async function recordAuthorResponse(
  supabase: SupabaseClient,
  workspaceId: string,
  authorProfileId: string,
  responseType: 'reply' | 'like'
): Promise<boolean>
```

#### Cooldown Logic

```typescript
// 5-day cooldown between comments on same author
const COOLDOWN_DAYS = 5;

function analyzeRelationship(relationship: AuthorRelationship): RelationshipContext {
  const daysSinceLastInteraction = relationship.last_interaction_at
    ? Math.floor((Date.now() - new Date(relationship.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (daysSinceLastInteraction < COOLDOWN_DAYS) {
    return {
      exists: true,
      relationship,
      recommendation: 'skip_cooldown',
      reason: `Last interaction was ${daysSinceLastInteraction} days ago (${COOLDOWN_DAYS}-day cooldown)`,
    };
  }

  // ... priority logic based on relationship strength
}
```

### 5. comment-variance.ts

**Location:** `/lib/anti-detection/comment-variance.ts`
**Purpose:** Randomize comment characteristics for anti-detection

```typescript
interface VarianceConfig {
  lengthCategory: 'very_short' | 'short' | 'medium' | 'long' | 'very_long';
  commentType: 'question' | 'statement' | 'story' | 'insight';
  characterRange: { min: number; max: number };
}

const LENGTH_RANGES = {
  very_short: { min: 50, max: 100 },
  short: { min: 100, max: 150 },
  medium: { min: 150, max: 250 },
  long: { min: 250, max: 350 },
  very_long: { min: 350, max: 450 },
};

// Pure random selection - no patterns
function getVarianceConfig(): VarianceConfig {
  const lengths = Object.keys(LENGTH_RANGES) as Array<keyof typeof LENGTH_RANGES>;
  const types = ['question', 'statement', 'story', 'insight'];

  const lengthCategory = lengths[Math.floor(Math.random() * lengths.length)];
  const commentType = types[Math.floor(Math.random() * types.length)];

  return {
    lengthCategory,
    commentType,
    characterRange: LENGTH_RANGES[lengthCategory],
  };
}
```

---

## API Endpoints

### Comment Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/linkedin-commenting/generate` | Generate comment for a post |
| POST | `/api/linkedin-commenting/generate-comment-ui` | Generate with UI metadata |
| POST | `/api/linkedin-commenting/generate-reply` | Generate reply to comment |
| POST | `/api/linkedin-commenting/auto-generate-comments` | Trigger auto-generation |

### Monitor Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/linkedin-commenting/monitors` | List all monitors |
| POST | `/api/linkedin-commenting/monitors` | Create new monitor |
| GET | `/api/linkedin-commenting/monitors/[id]` | Get monitor details |
| DELETE | `/api/linkedin-commenting/monitors/[id]` | Delete monitor |
| POST | `/api/linkedin-commenting/monitors/poll` | Poll for new posts |

### Comment Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/linkedin-commenting/comments` | List comments |
| POST | `/api/linkedin-commenting/comments/[id]/approve` | Approve comment |
| POST | `/api/linkedin-commenting/comments/[id]/reject` | Reject comment |
| POST | `/api/linkedin-commenting/comments/[id]/regenerate` | Regenerate comment |
| POST | `/api/linkedin-commenting/bulk-approve` | Bulk approve |
| GET | `/api/linkedin-commenting/pending-comments` | List pending |
| GET | `/api/linkedin-commenting/posted-comments` | List posted |

### Post Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/linkedin-commenting/get-discovered-posts` | List discovered posts |
| POST | `/api/linkedin-commenting/save-discovered-posts` | Save new posts |
| GET | `/api/linkedin-commenting/discover-posts-hashtag` | Discover by hashtag |
| GET | `/api/linkedin-commenting/discover-profile-posts` | Discover by profile |
| GET | `/api/linkedin-commenting/discover-company-posts` | Discover by company |

### Settings & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/linkedin-commenting/settings` | Workspace settings |
| GET | `/api/linkedin-commenting/analytics` | Analytics dashboard |
| GET | `/api/linkedin-commenting/stats` | Quick statistics |
| POST | `/api/linkedin-commenting/rate-limit-check` | Check LinkedIn limits |

---

## Scheduled Functions (Cron Jobs)

### Overview

| Function | Schedule | Purpose |
|----------|----------|---------|
| `discover-posts` | Every 2 hours | Discover posts from profile monitors |
| `discover-posts-brightdata` | Every 4 hours | Discover posts from hashtag monitors |
| `auto-generate-comments` | Every 30 minutes | Generate AI comments |
| `process-comment-queue` | Every 45 minutes | Post approved comments |
| `track-comment-performance` | Every 6 hours | Track engagement on posted comments |
| `commenting-digest` | Daily 5 AM PT | Email digest of activity |
| `discover-self-post-comments` | Every 30 minutes | Find comments on own posts |
| `process-self-post-replies` | Every 30 minutes | Reply to comments on own posts |

### netlify.toml Configuration

```toml
# Discover Posts (Profiles): Find new posts from PROFILE monitors via Unipile API
[functions."discover-posts"]
  schedule = "0 */2 * * *"

# Discover Posts (Hashtags): Find new posts from hashtag monitors via Bright Data
[functions."discover-posts-brightdata"]
  schedule = "0 */4 * * *"

# Auto-Generate Comments: Create AI comments every 30 minutes
[functions."auto-generate-comments"]
  schedule = "*/30 * * * *"

# Process Comment Queue: Post scheduled comments every 45 minutes
[functions."process-comment-queue"]
  schedule = "*/45 * * * *"

# Track Comment Performance: Check engagement every 6 hours
[functions."track-comment-performance"]
  schedule = "0 */6 * * *"

# Commenting Digest: Daily email Mon-Fri 5:00 AM PT (13:00 UTC)
[functions."commenting-digest"]
  schedule = "0 13 * * 1-5"

# Discover Self-Post Comments: Every 30 minutes
[functions."discover-self-post-comments"]
  schedule = "*/30 * * * *"

# Process Self-Post Replies: Every 30 minutes
[functions."process-self-post-replies"]
  schedule = "*/30 * * * *"
```

### auto-generate-comments Details

**Location:** `/app/api/cron/auto-generate-comments/route.ts`

```typescript
// Anti-detection measures
const SKIP_PROBABILITY = 0.10;  // 10% chance to skip run
const MAX_DELAY_MS = 10 * 60 * 1000;  // 0-10 min random delay

export async function POST(request: NextRequest) {
  // 1. Random skip check
  if (Math.random() < SKIP_PROBABILITY) {
    return NextResponse.json({ skipped: true, reason: 'Random skip for anti-detection' });
  }

  // 2. Random delay
  const delay = Math.floor(Math.random() * MAX_DELAY_MS);
  await new Promise(resolve => setTimeout(resolve, delay));

  // 3. Get pending posts with quality score
  const posts = await getPendingPosts(workspaceId);

  for (const post of posts) {
    // 4. Calculate engagement quality score
    const qualityScore = calculateEngagementQuality({
      engagement_metrics: post.engagement_metrics,
      post_date: post.discovered_at,
      post_content: post.post_content,
      author_headline: post.author_headline,
    });

    if (qualityScore.recommendation === 'skip') continue;

    // 5. Check author relationship
    const relationshipContext = await getAuthorRelationshipContext(
      supabase, workspaceId, authorId, post.author_name
    );

    if (relationshipContext.recommendation === 'skip_cooldown') continue;

    // 6. Generate comment with variance
    const varianceConfig = getVarianceConfig();
    const comment = await generateLinkedInComment(post, brandGuidelines, {
      varianceConfig,
      relationshipContext,
    });

    // 7. Save to database
    await saveComment(comment);

    // 8. Record author interaction
    await recordAuthorInteraction(supabase, workspaceId, authorId, {
      author_name: post.author_name,
      topic: extractTopicFromPost(post.post_content),
      comment_id: comment.id,
    });
  }
}
```

---

## Database Schema

### Core Tables

#### linkedin_posts_discovered

```sql
CREATE TABLE linkedin_posts_discovered (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  monitor_id UUID REFERENCES linkedin_post_monitors(id),

  -- Post identification
  linkedin_post_id TEXT NOT NULL,
  post_url TEXT,
  post_content TEXT,
  post_type TEXT,  -- 'text', 'image', 'video', 'article', 'poll'

  -- Author info
  author_name TEXT,
  author_profile_url TEXT,
  author_profile_id TEXT,
  author_headline TEXT,
  author_company TEXT,

  -- Engagement
  engagement_metrics JSONB,  -- { reactions: 50, comments: 10, shares: 5 }

  -- Quality scoring (NEW - Dec 16, 2025)
  engagement_quality_score INTEGER,
  quality_factors JSONB,

  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'processed', 'skipped'
  processed_at TIMESTAMP,
  skip_reason TEXT,

  -- Timestamps
  discovered_at TIMESTAMP DEFAULT NOW(),
  post_date TIMESTAMP,

  UNIQUE(workspace_id, linkedin_post_id)
);
```

#### linkedin_post_comments

```sql
CREATE TABLE linkedin_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  post_id UUID NOT NULL REFERENCES linkedin_posts_discovered(id),

  -- Comment content
  comment_text TEXT NOT NULL,
  comment_type TEXT,  -- 'question', 'statement', 'story', 'insight'
  length_category TEXT,  -- 'very_short', 'short', 'medium', 'long', 'very_long'

  -- LinkedIn IDs (after posting)
  linkedin_comment_id TEXT,

  -- Status workflow
  status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'posted', 'failed'
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,

  -- Performance tracking (NEW - Dec 16, 2025)
  reactions_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  performance_score INTEGER,
  last_engagement_check TIMESTAMP,
  author_replied BOOLEAN DEFAULT FALSE,
  author_liked BOOLEAN DEFAULT FALSE,

  -- Generation metadata
  variance_config JSONB,
  generation_prompt TEXT,
  ai_model TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### linkedin_author_relationships

```sql
CREATE TABLE linkedin_author_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  author_profile_id TEXT NOT NULL,

  -- Author info
  author_name TEXT,
  author_headline TEXT,
  author_company TEXT,

  -- Interaction metrics
  total_comments_made INTEGER DEFAULT 0,
  total_replies_received INTEGER DEFAULT 0,
  total_likes_received INTEGER DEFAULT 0,
  author_responded_count INTEGER DEFAULT 0,

  -- Performance
  avg_performance_score DECIMAL(5,2),
  best_performing_topic TEXT,

  -- Timing
  first_interaction_at TIMESTAMP,
  last_interaction_at TIMESTAMP,
  last_comment_at TIMESTAMP,

  -- Status
  relationship_strength TEXT DEFAULT 'new',  -- 'new', 'engaged', 'responsive', 'advocate'

  -- Topics (for variety)
  topics_discussed TEXT[],

  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(workspace_id, author_profile_id)
);
```

#### linkedin_comment_performance_stats

```sql
CREATE TABLE linkedin_comment_performance_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Aggregate metrics
  total_comments INTEGER DEFAULT 0,
  total_posted INTEGER DEFAULT 0,
  total_with_engagement INTEGER DEFAULT 0,
  total_reactions INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  author_response_rate DECIMAL(5,2),

  -- Breakdown by type
  performance_by_type JSONB,    -- { question: { count: 10, avg_score: 65 }, ... }
  performance_by_length JSONB,  -- { short: { count: 5, avg_score: 70 }, ... }

  -- Learning
  top_openers TEXT[],  -- Best performing comment openers

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(workspace_id, period_start, period_end)
);
```

#### linkedin_brand_guidelines

```sql
CREATE TABLE linkedin_brand_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Quick settings
  tone TEXT DEFAULT 'professional',  -- 'casual', 'professional', 'authoritative'
  formality TEXT DEFAULT 'balanced', -- 'informal', 'balanced', 'formal'
  default_length TEXT DEFAULT 'medium',

  -- Your expertise
  expertise TEXT[],
  industry TEXT,
  role TEXT,

  -- Brand voice
  voice_description TEXT,
  example_comments TEXT[],

  -- Vibe check
  humor_level INTEGER DEFAULT 3,      -- 1-5
  bluntness_level INTEGER DEFAULT 3,  -- 1-5
  personalization_level INTEGER DEFAULT 3,  -- 1-5

  -- Framework
  preferred_framework TEXT DEFAULT 'flexible',  -- 'ACA+I', 'VAR', 'Hook-Value-Bridge', 'flexible'

  -- Guardrails
  competitors_to_avoid TEXT[],
  topics_to_avoid TEXT[],
  banned_phrases TEXT[],

  -- Scheduling
  timezone TEXT DEFAULT 'America/Los_Angeles',
  active_hours_start INTEGER DEFAULT 9,   -- 9 AM
  active_hours_end INTEGER DEFAULT 17,    -- 5 PM
  active_days INTEGER[] DEFAULT '{1,2,3,4,5}',  -- Mon-Fri

  -- Advanced
  custom_system_prompt TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(workspace_id)
);
```

### RLS Policies

All tables have Row Level Security enabled with workspace isolation:

```sql
-- Example policy for linkedin_post_comments
CREATE POLICY "Users can view their workspace comments"
  ON linkedin_post_comments FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert comments in their workspace"
  ON linkedin_post_comments FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Service role bypasses RLS for cron jobs
CREATE POLICY "Service role manages comments"
  ON linkedin_post_comments FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

---

## Anti-Detection System

### Overview

The commenting agent uses multiple anti-detection measures to avoid LinkedIn's spam detection:

### 1. Comment Variance

Every comment is randomly assigned:

- **Length category**: very_short (50-100), short (100-150), medium (150-250), long (250-350), very_long (350-450)
- **Comment type**: question, statement, story, insight

```typescript
// Pure random - no patterns
const varianceConfig = getVarianceConfig();
// Result: { lengthCategory: 'medium', commentType: 'question', characterRange: { min: 150, max: 250 } }
```

### 2. Timing Randomization

- **Skip probability**: 10% chance to skip each cron run
- **Random delay**: 0-10 minutes before processing
- **Posting interval**: One comment every 30+ minutes

### 3. Banned Phrases

50+ generic AI phrases are blocked:

```typescript
const BANNED_PHRASES = [
  'great post', 'love this', 'thanks for sharing',
  'couldn\'t agree more', 'this is so true', 'well said',
  'absolutely', 'totally agree', 'spot on', 'nailed it',
  'this resonates', 'so important', 'this is gold',
  // ... more
];
```

### 4. Author Cooldown

5-day minimum between comments on same author's posts.

### 5. Topic Variety

Tracks topics discussed with each author to avoid repetition.

### 6. Rate Limiting

- Maximum 20 comments per day per account
- Business hours only (configurable)
- Weekday bias (configurable)

---

## Brand Guidelines

### Configuration Sections

#### 1. Quick Settings

```typescript
interface QuickSettings {
  tone: 'casual' | 'professional' | 'authoritative';
  formality: 'informal' | 'balanced' | 'formal';
  default_length: 'short' | 'medium' | 'long';
}
```

#### 2. Your Expertise

```typescript
interface Expertise {
  expertise: string[];      // ['B2B Sales', 'AI', 'SaaS']
  industry: string;         // 'Technology'
  role: string;             // 'CEO'
}
```

#### 3. Brand Voice

```typescript
interface BrandVoice {
  voice_description: string;  // "Confident but approachable..."
  example_comments: string[]; // 3-5 example comments you've written
}
```

#### 4. Vibe Check

```typescript
interface VibeCheck {
  humor_level: 1 | 2 | 3 | 4 | 5;        // 1=None, 5=Frequent
  bluntness_level: 1 | 2 | 3 | 4 | 5;    // 1=Diplomatic, 5=Direct
  personalization_level: 1 | 2 | 3 | 4 | 5; // 1=Generic, 5=Highly personal
}
```

#### 5. Comment Framework

```typescript
type Framework =
  | 'ACA+I'           // Acknowledge, Complement, Add, Invite
  | 'VAR'             // Value, Acknowledge, Relate
  | 'Hook-Value-Bridge' // Hook, Value, Bridge to conversation
  | 'flexible';       // AI chooses best framework
```

#### 6. Guardrails

```typescript
interface Guardrails {
  competitors_to_avoid: string[];  // Never mention these companies
  topics_to_avoid: string[];       // Avoid political, religious, etc.
  banned_phrases: string[];        // Custom banned phrases
}
```

---

## Quality Scoring System

### Post Quality Score (0-100)

Posts are scored before comment generation to prioritize high-quality opportunities:

| Factor | Max Points | Description |
|--------|------------|-------------|
| Engagement | 30 | Reactions + comments (log scale) |
| Discussion | 25 | Comment-to-reaction ratio |
| Recency | 20 | Hours since posted |
| Content Depth | 15 | Post length and substance |
| Author Quality | 10 | Headline keywords |

### Recommendations

| Score | Recommendation | Action |
|-------|----------------|--------|
| 70-100 | `high_priority` | Comment immediately |
| 45-69 | `normal` | Standard processing |
| 25-44 | `low_priority` | Comment if capacity |
| 0-24 | `skip` | Don't comment |

### Usage in Code

```typescript
const qualityScore = calculateEngagementQuality({
  engagement_metrics: { reactions: 150, comments: 25 },
  post_date: '2025-12-16T10:00:00Z',
  post_content: 'Long thoughtful post about AI trends...',
  author_headline: 'CEO at TechCorp | AI Expert',
});

// Result:
// {
//   total_score: 78,
//   factors: {
//     engagement_score: 28,
//     discussion_score: 17,
//     recency_score: 18,
//     content_depth_score: 10,
//     author_quality_score: 5
//   },
//   recommendation: 'high_priority'
// }
```

---

## Performance Tracking

### What's Tracked

For each posted comment:

- **Reactions count** - Likes, celebrates, etc.
- **Replies count** - Direct replies to our comment
- **Author replied** - Did the post author respond?
- **Author liked** - Did the post author like our comment?
- **Performance score** - Calculated 0-100

### Performance Score Calculation

```typescript
function calculatePerformanceScore(perf: CommentPerformance): number {
  let score = 0;

  score += Math.min(40, perf.reactions_count * 4);  // Max 40
  score += Math.min(30, perf.replies_count * 10);   // Max 30
  if (perf.author_replied) score += 20;             // Bonus 20
  if (perf.author_liked) score += 10;               // Bonus 10

  return Math.min(100, score);
}
```

### Weekly Aggregation

Every Sunday, the system aggregates:

- Total comments posted
- Average performance score
- Best performing comment types
- Best performing length categories
- Top performing openers (first 50 chars)
- Author response rate

### Learning Loop

High-performing patterns are identified and fed back into generation:

```typescript
// In auto-generate-comments
const topOpeners = await getTopPerformingOpeners(workspaceId);
// Adds to prompt: "High-performing openers include: ..."
```

---

## Author Relationship Memory

### Relationship Strength Progression

```
┌─────────┐    3+ comments    ┌──────────┐    1+ reply    ┌────────────┐    3+ replies    ┌──────────┐
│   NEW   │ ───────────────► │ ENGAGED  │ ─────────────► │ RESPONSIVE │ ────────────────► │ ADVOCATE │
└─────────┘                   └──────────┘                └────────────┘                   └──────────┘
   <3 comments                  3+ comments               Author replied                   Author replied
   no responses                 no responses              at least once                    3+ times
```

### What's Tracked Per Author

```typescript
interface AuthorRelationship {
  author_profile_id: string;
  author_name: string;
  author_headline: string;

  total_comments_made: number;
  total_replies_received: number;
  total_likes_received: number;
  author_responded_count: number;

  relationship_strength: 'new' | 'engaged' | 'responsive' | 'advocate';

  first_interaction_at: Date;
  last_interaction_at: Date;
  last_comment_at: Date;

  topics_discussed: string[];  // Last 10 topics
  best_performing_topic: string;
}
```

### Context for Comment Generation

Before generating a comment, the system provides context:

```typescript
// For responsive/advocate authors
{
  recommendation: 'high_priority',
  reason: 'John Smith has engaged with us before (responsive)',
  suggested_approach: 'They\'ve replied to you before - reference past conversation if relevant. Best engagement on topic: "AI automation"',
  topics_to_avoid: ['sales automation', 'CRM integration', 'lead generation'],  // Last 3 topics
}

// For cooldown
{
  recommendation: 'skip_cooldown',
  reason: 'Last interaction was 2 days ago (5-day cooldown)',
}
```

---

## UI Components

### CommentingAgentModal

**Location:** `/app/components/CommentingAgentModal.tsx`

Main modal for enabling/configuring the commenting agent:

- Check LinkedIn account connection
- Enable/disable commenting
- Navigate to settings

### CommentingAgentSettings

**Location:** `/app/components/CommentingAgentSettings.tsx`

Full brand guidelines configuration:

- Quick settings (tone, formality, length)
- Expertise and industry
- Brand voice description
- Example comments
- Vibe check sliders
- Framework selection
- Guardrails configuration
- Custom system prompt (advanced)

### CommentApprovalWorkflow

**Location:** `/app/components/CommentApprovalWorkflow.tsx`

HITL approval interface:

- View pending comments
- See original post context
- Approve/reject/edit comments
- Bulk approval
- Regenerate with feedback

### Dashboard Pages

| Page | Purpose |
|------|---------|
| `/commenting-agent` | Main dashboard with stats |
| `/commenting-agent/approve` | Approval workflow |
| `/commenting-agent/profiles` | Manage monitored profiles |
| `/commenting-agent/my-posts` | Self-post monitoring |
| `/commenting-agent/analytics` | Performance analytics |

---

## Configuration

### Environment Variables

```bash
# Netlify environment (production)
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=<your_api_key>
CRON_SECRET=<random_secret>
OPENROUTER_API_KEY=<openrouter_key>
POSTMARK_SERVER_TOKEN=<postmark_token>
```

### Workspace Settings

Stored in `linkedin_commenting_settings` table:

```typescript
interface CommentingSettings {
  enabled: boolean;
  auto_approve: boolean;
  auto_approve_threshold: number;  // Quality score threshold
  daily_limit: number;             // Max comments per day
  active_hours_start: number;      // 9 = 9 AM
  active_hours_end: number;        // 17 = 5 PM
  active_days: number[];           // [1,2,3,4,5] = Mon-Fri
  timezone: string;                // 'America/Los_Angeles'
}
```

### Rate Limits

| Limit | Value | Enforced By |
|-------|-------|-------------|
| Comments per day | 20 | Daily counter |
| Comments per hour | 2 | Cron spacing |
| Min interval | 30 min | Queue system |
| Author cooldown | 5 days | Relationship tracker |

---

## Troubleshooting

### Common Issues

#### Comments Not Generating

1. Check if workspace has LinkedIn account connected
2. Verify brand guidelines are configured
3. Check if there are pending posts with `status = 'pending'`
4. Review cron logs: `netlify logs:function auto-generate-comments`

#### Comments Not Posting

1. Check comment status is `approved`
2. Verify Unipile account is connected
3. Check rate limits haven't been exceeded
4. Review cron logs: `netlify logs:function process-comment-queue`

#### Low Quality Scores

1. Posts may be too old (recency penalty)
2. Low engagement (reactions/comments)
3. Author doesn't have relevant headline
4. Post content too short

### Debugging Commands

```bash
# View auto-generate logs
netlify logs:function auto-generate-comments --tail

# View posting logs
netlify logs:function process-comment-queue --tail

# View performance tracking logs
netlify logs:function track-comment-performance --tail

# Check pending comments
curl https://app.meet-sam.com/api/linkedin-commenting/pending-comments \
  -H "Authorization: Bearer <token>"

# Check discovered posts
curl https://app.meet-sam.com/api/linkedin-commenting/get-discovered-posts \
  -H "Authorization: Bearer <token>"
```

### Monitoring Queries

```sql
-- Pending comments by workspace
SELECT workspace_id, COUNT(*) as pending
FROM linkedin_post_comments
WHERE status = 'pending'
GROUP BY workspace_id;

-- Posted comments last 7 days
SELECT DATE(posted_at), COUNT(*)
FROM linkedin_post_comments
WHERE status = 'posted'
  AND posted_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(posted_at)
ORDER BY DATE(posted_at);

-- Top performing comments
SELECT comment_text, performance_score, reactions_count, replies_count
FROM linkedin_post_comments
WHERE status = 'posted'
  AND performance_score IS NOT NULL
ORDER BY performance_score DESC
LIMIT 10;

-- Author relationships
SELECT author_name, relationship_strength, total_comments_made, author_responded_count
FROM linkedin_author_relationships
WHERE relationship_strength IN ('responsive', 'advocate')
ORDER BY author_responded_count DESC;
```

---

## Changelog

### December 16, 2025
- Added engagement quality scoring system
- Added comment performance tracking cron job
- Added author relationship memory
- New tables: `linkedin_author_relationships`, `linkedin_comment_performance_stats`
- New columns on `linkedin_post_comments`: reactions_count, replies_count, performance_score, author_replied, author_liked

### December 11, 2025
- Upgraded to Claude Haiku 4.5
- Added comment variance system (random length/type)
- Enhanced banned phrases detection

### December 7, 2025
- Cost optimization: Switched from Claude Opus 3 to Haiku 4.5
- Added anti-detection skip probability

### December 1, 2025
- Initial release of LinkedIn Commenting Agent
- Profile and hashtag monitoring
- AI comment generation
- HITL approval workflow
- Daily digest emails

---

**Documentation maintained by:** Claude Code
**Last verified:** December 16, 2025
**Production status:** Fully operational
