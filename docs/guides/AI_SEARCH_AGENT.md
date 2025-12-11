# AI Search Agent (GEO - Generative Engine Optimization)

**Date:** December 11, 2025
**Status:** DEPLOYED TO PRODUCTION

---

## Summary

The AI Search Agent analyzes websites for SEO and GEO (Generative Engine Optimization) to help users create content that ranks in AI search engines like ChatGPT, Perplexity, Claude, and Google AI Overviews.

**Key Features:**
- Website SEO analysis (meta tags, structured data, robots.txt, sitemap)
- GEO analysis (LLM readability, entity clarity, fact density, citation readiness)
- Learning from outreach and commenting performance
- AI-generated content strategy recommendations

---

## What is GEO?

**GEO (Generative Engine Optimization)** is the practice of optimizing content for AI search engines, rather than traditional search engines.

### Traditional SEO vs GEO

| Aspect | Traditional SEO | GEO |
|--------|-----------------|-----|
| Target | Google, Bing crawlers | AI/LLMs (ChatGPT, Perplexity, Claude) |
| Goal | Rank in search results | Be cited in AI-generated answers |
| Keywords | Keyword density, placement | Natural language, clear definitions |
| Content | Optimized for snippets | Optimized for understanding |
| Structure | H1-H6, meta tags | Clear entity relationships |
| Metrics | Page rank, CTR | Citation likelihood, fact density |

### GEO Scoring Criteria

1. **LLM Readability (0-100)**
   - Can AI easily parse and understand the content?
   - Is there a logical flow?
   - Are concepts explained clearly?

2. **Entity Clarity (0-100)**
   - Are key entities (people, companies, concepts) clearly defined?
   - Can AI extract WHO, WHAT, WHEN, WHERE, WHY?
   - Are relationships between entities clear?

3. **Fact Density (0-100)**
   - Does content contain specific, citable facts?
   - Are there statistics, data points, or unique insights?
   - Is there original research or proprietary information?

4. **Citation Readiness (0-100)**
   - Is this source authoritative on its topic?
   - Would an AI confidently cite this source?
   - Does it have credibility signals (author info, dates, sources)?

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI SEARCH AGENT FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INITIAL SETUP (One-time)                                     │
│     ├─> User enters website URL                                  │
│     └─> URL is LOCKED (cannot be changed)                        │
│                                                                  │
│  2. WEBSITE ANALYSIS                                             │
│     ├─> Fetch website HTML                                       │
│     ├─> Analyze SEO (meta tags, structured data, robots, sitemap)│
│     ├─> Analyze GEO (via Claude AI)                              │
│     │   ├─> LLM Readability                                      │
│     │   ├─> Entity Clarity                                       │
│     │   ├─> Fact Density                                         │
│     │   └─> Citation Readiness                                   │
│     └─> Store results in database                                │
│                                                                  │
│  3. LEARNING FROM OTHER AGENTS                                   │
│     ├─> Analyze outreach message performance                     │
│     ├─> Analyze commenting engagement                            │
│     └─> Extract themes that resonate                             │
│                                                                  │
│  4. CONTENT STRATEGY GENERATION                                  │
│     ├─> Combine analysis + learnings                             │
│     ├─> Generate content pillars                                 │
│     ├─> Suggest topics to cover                                  │
│     └─> Recommend content formats                                │
│                                                                  │
│  5. RECOMMENDATIONS                                              │
│     ├─> Prioritized list of improvements                         │
│     ├─> Implementation steps for each                            │
│     └─> Impact estimates                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/services/ai-search-agent.ts` | Core agent service - analysis, learning, strategy |
| `app/components/AISearchAgentModal.tsx` | Settings UI component |
| `app/components/AIConfiguration.tsx` | AI agents hub (includes AI Search Agent) |
| `app/api/ai-search-agent/config/route.ts` | Config API (GET/POST/PATCH) |
| `app/api/ai-search-agent/analyze/route.ts` | Analysis API (POST/GET) |
| `app/api/ai-search-agent/content-strategy/route.ts` | Strategy API (GET) |
| `sql/migrations/040-create-ai-search-agent-tables.sql` | Database schema |

---

## Database Schema

### workspace_ai_search_config

Per-workspace configuration for the AI Search Agent.

```sql
CREATE TABLE workspace_ai_search_config (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL UNIQUE,

  -- Website (LOCKED after setup)
  website_url TEXT NOT NULL,
  website_locked BOOLEAN DEFAULT true,

  -- Settings
  enabled BOOLEAN DEFAULT true,
  auto_analyze_prospects BOOLEAN DEFAULT false,
  analysis_depth VARCHAR(20) DEFAULT 'standard',

  -- SEO Checks
  check_meta_tags BOOLEAN DEFAULT true,
  check_structured_data BOOLEAN DEFAULT true,
  check_robots_txt BOOLEAN DEFAULT true,
  check_sitemap BOOLEAN DEFAULT true,

  -- GEO Checks
  check_llm_readability BOOLEAN DEFAULT true,
  check_entity_clarity BOOLEAN DEFAULT true,
  check_fact_density BOOLEAN DEFAULT true,
  check_citation_readiness BOOLEAN DEFAULT true,

  -- Learning
  learn_from_outreach BOOLEAN DEFAULT true,
  learn_from_comments BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### website_analysis_results

Stores SEO and GEO analysis results.

```sql
CREATE TABLE website_analysis_results (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  website_url TEXT NOT NULL,
  domain VARCHAR(255) NOT NULL,

  -- Status
  status VARCHAR(30) DEFAULT 'pending',
  analyzed_at TIMESTAMPTZ,

  -- Scores (0-100)
  seo_score INTEGER,
  geo_score INTEGER,
  overall_score INTEGER,

  -- Detailed Results (JSONB)
  seo_results JSONB DEFAULT '{}',
  geo_results JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '[]',

  -- Summary
  executive_summary TEXT,

  -- Metadata
  fetch_duration_ms INTEGER,
  analysis_duration_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);
```

---

## API Endpoints

### GET /api/ai-search-agent/config

Get configuration for a workspace.

**Query Parameters:**
- `workspace_id` (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "workspace_id": "...",
    "website_url": "https://example.com",
    "website_locked": true,
    "enabled": true,
    "analysis_depth": "standard",
    ...
  }
}
```

### POST /api/ai-search-agent/config

Create initial configuration with locked website URL.

**Request Body:**
```json
{
  "workspace_id": "...",
  "website_url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Errors:**
- `409` - Config already exists (website URL cannot be changed)

### PATCH /api/ai-search-agent/config

Update configuration settings (website URL cannot be changed).

**Request Body:**
```json
{
  "workspace_id": "...",
  "enabled": true,
  "analysis_depth": "comprehensive",
  "learn_from_outreach": true
}
```

### POST /api/ai-search-agent/analyze

Run website analysis.

**Request Body:**
```json
{
  "workspace_id": "...",
  "website_url": "https://example.com",
  "depth": "standard",
  "include_learnings": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "seo_score": 75,
    "geo_score": 65,
    "overall_score": 70,
    "executive_summary": "Your website scores 70/100...",
    "recommendations": [...]
  }
}
```

### GET /api/ai-search-agent/content-strategy

Generate content strategy based on analysis and learnings.

**Query Parameters:**
- `workspace_id` (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "strategy": "Focus on creating authoritative content...",
    "content_pillars": ["B2B Sales", "AI Automation", "LinkedIn Growth"],
    "topics_to_cover": ["How to automate outreach", "GEO optimization tips", ...],
    "format_recommendations": ["Long-form guides", "Data-driven case studies", ...]
  }
}
```

---

## How Learning Works

The AI Search Agent learns from two sources:

### 1. Outreach Campaigns

Analyzes message performance from connector/messenger campaigns:
- Response rates by message type
- Themes that get responses vs. those that don't
- Successful opening hooks and CTAs

### 2. Commenting Agent

Analyzes engagement from LinkedIn commenting:
- Topics that resonate with the audience
- Comment styles that drive engagement
- Hashtags and keywords that perform well

### Combined Insights

The agent combines these learnings to identify:
- **Key themes** - Topics your audience cares about
- **Voice characteristics** - Tone and style that work
- **Content recommendations** - What to create next

---

## User Flow

### Initial Setup

1. User opens AI Search Agent from AI Configuration
2. Enters their website URL
3. URL is **locked** - cannot be changed after setup
4. First analysis runs automatically

### Ongoing Usage

1. View latest analysis scores (SEO + GEO)
2. Review recommendations with priority levels
3. Generate content strategy based on learnings
4. Re-run analysis after making changes

---

## Important Notes

### Website URL is Locked

Once a user enters their website URL, it **cannot be changed**. This is intentional:
- Prevents gaming the system
- Ensures consistent tracking over time
- Links analysis to specific domain

### Analysis Takes Time

A full analysis takes 30-60 seconds because it:
1. Fetches the website HTML
2. Parses and analyzes SEO factors
3. Sends content to Claude for GEO analysis
4. Gathers learnings from campaigns/comments
5. Generates recommendations

### Results Expire

Analysis results expire after 30 days. Users should re-run analysis periodically to track improvements.

---

## Testing

### Run Manual Analysis

```bash
curl -X POST "https://app.meet-sam.com/api/ai-search-agent/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "YOUR_WORKSPACE_ID",
    "website_url": "https://example.com",
    "depth": "standard"
  }'
```

### Check Config

```bash
curl "https://app.meet-sam.com/api/ai-search-agent/config?workspace_id=YOUR_WORKSPACE_ID"
```

### Generate Strategy

```bash
curl "https://app.meet-sam.com/api/ai-search-agent/content-strategy?workspace_id=YOUR_WORKSPACE_ID"
```

---

## Troubleshooting

### Analysis Fails

1. **Check URL is valid** - Must be a reachable website
2. **Check website responds** - Some sites block bots
3. **Check timeout** - Analysis times out after 60 seconds
4. **Check logs** - Netlify function logs show detailed errors

### Low GEO Score

Common issues:
- Content not structured clearly
- Missing entity definitions
- Lack of specific facts/data
- No clear expertise signals

### Learning Shows Empty

If learning from outreach/comments shows no data:
- Need at least 10+ messages sent
- Need at least 10+ comments posted
- Data takes time to accumulate

---

## Environment Variables

No new environment variables required. Uses existing:

```bash
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY  # For GEO analysis via Claude
```

---

## Deployment

The AI Search Agent is deployed as part of the main application. No separate deployment needed.

### Database Migration

Run the migration to create tables:

```sql
-- Copy contents of sql/migrations/040-create-ai-search-agent-tables.sql
-- Execute in Supabase SQL Editor
```

---

## Next Steps

1. **Monitor usage** - Track how many workspaces use the agent
2. **Improve GEO analysis** - Add more signals and factors
3. **Add scheduled re-analysis** - Auto-analyze weekly
4. **Add competitor comparison** - Compare GEO scores to competitors
5. **Add content generation** - Generate AI-optimized content directly

---

## Changelog

| Date | Change | Status |
|------|--------|--------|
| Dec 11, 2025 | Initial AI Search Agent implementation | DEPLOYED |
| Dec 11, 2025 | Integration with outreach/commenting learnings | DEPLOYED |
| Dec 11, 2025 | Content strategy generation | DEPLOYED |
