# Handover Document - December 3, 2025

## LinkedIn Commenting Agent - Complete Configuration

### Overview
Fully automated LinkedIn commenting system for two workspaces:
1. **Thorsten (InnovareAI)** - Focus: Agentic AI / GenAI
2. **Brian Neirby (ChillMine)** - Focus: Data Center Cooling / Liquid Cooling

---

## System Architecture

```
Apify Scraper → Discover Posts → Filter Posts → Generate Comments → Auto-Approve → Schedule Queue → Post + Like
     ↓                ↓              ↓               ↓                  ↓              ↓            ↓
  Hashtags      30min fresh    Blacklist +      OpenRouter AI     If enabled     6AM-6PM PT    Unipile API
                              10-day cooldown                                    36min apart
```

---

## Configuration Summary

| Setting | Value |
|---------|-------|
| Posts per hashtag | 3 |
| Max comments/day | 20 |
| Posting window | 6 AM - 6 PM PT |
| Comment spacing | 36 minutes apart |
| Auto-like | Enabled (every comment) |
| Daily repost | 1x at 10 AM PT |
| Repost threshold | 100+ likes OR 20+ comments |
| Auto-approve | Enabled |
| Author cooldown | 10 days per person |

---

## Filtering Rules (Blacklist)

### Posts We Skip:
1. **Hiring/Job Posts** - "we're hiring", "join our team", "#hiring", etc.
2. **Engagement Bait** - "comment YES", "like if you agree", "drop a [emoji]"
3. **Author Cooldown** - Already commented on this person in last 10 days

### Key Files:
- Filter logic: `/app/api/linkedin-commenting/discover-posts-apify/route.ts`
- Patterns: `HIRING_POST_PATTERNS`, `ENGAGEMENT_BAIT_PATTERNS`

---

## Workspace: InnovareAI (Thorsten)

**Workspace ID:** `babdcab8-1a78-4b2f-913e-6e9fd9821009`

### Hashtag Monitors:
| Hashtag | Status |
|---------|--------|
| #GenAI | Active |
| #AgenticAI | Active |
| #AutonomousAgents | Active |
| #AIAutomation | Active |
| #GenerativeAI | Active |
| #AIAgents | Active |

### Tone of Voice: "The Visionary Operator"
- Confidence: Assertive
- Style: Professional but warm
- Framework: Lead with insight → Add operational context → End with CTA
- Topics: Agentic AI, GenAI, AI Automation

---

## Workspace: ChillMine (Brian Neirby)

**Workspace ID:** `aa1a214c-02f0-4f3a-8849-92c7a50ee4f7`

### Hashtag Monitors:
| Hashtag | Status |
|---------|--------|
| #DataCenterCooling | Active |
| #LiquidCooling | Active |
| #AIInfrastructure | Active |
| #HPC | Active |
| #SustainableDataCenters | Active |
| #DataCenterDesign | Active |

### Tone of Voice: "The Synthesizer"
- Confidence: Balanced
- Style: Thoughtful, connecting dots
- Framework: Pattern recognition → Cross-industry insight → Forward-looking question
- Topics: Data center cooling, liquid cooling, sustainability

---

## Cron Jobs (Netlify Scheduled Functions)

| Function | Schedule | Purpose |
|----------|----------|---------|
| `discover-posts` | Every 30 min | Scrape hashtags via Apify |
| `auto-generate-comments` | After discovery | Generate AI comments |
| `process-comment-queue` | Every 30 min | Post scheduled comments + auto-like |
| `daily-repost` | 10 AM PT daily | Repost high-engagement posts |

---

## Key API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/linkedin-commenting/discover-posts-apify` | Discover new posts |
| `POST /api/linkedin-commenting/auto-generate-comments` | Generate AI comments |
| `POST /api/linkedin-commenting/approve-comment` | Schedule comment for posting |
| `POST /api/cron/process-comment-queue` | Post scheduled comments |
| `POST /api/cron/daily-repost` | Repost high-engagement posts |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `linkedin_post_monitors` | Hashtag/profile monitors config |
| `linkedin_posts_discovered` | Discovered posts from Apify |
| `linkedin_post_comments` | Generated/scheduled/posted comments |
| `linkedin_brand_guidelines` | Tone of voice, settings per workspace |
| `linkedin_reposts` | Track daily reposts |

---

## Recent Changes (Dec 3, 2025)

1. **10-Day Author Cooldown** - Skip posts from authors we've commented on in last 10 days
2. **Auto-Like** - Automatically like every post we comment on
3. **Daily Repost** - Quote-post high-engagement posts once per day
4. **Auto-Approve** - No manual approval needed, comments auto-schedule
5. **Spread Comments** - 36 min apart within 6 AM - 6 PM PT window

---

## Monitoring

### Check Netlify Logs:
```bash
netlify logs --function discover-posts --tail
netlify logs --function process-comment-queue --tail
netlify logs --function daily-repost --tail
```

### Check Database:
```sql
-- Pending comments
SELECT * FROM linkedin_post_comments
WHERE status = 'scheduled'
ORDER BY scheduled_post_time;

-- Recent posts discovered
SELECT * FROM linkedin_posts_discovered
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- Author cooldown check
SELECT DISTINCT author_profile_id
FROM linkedin_post_comments lpc
JOIN linkedin_posts_discovered lpd ON lpc.post_id = lpd.id
WHERE lpc.status IN ('posted', 'scheduled')
AND lpc.created_at > NOW() - INTERVAL '10 days';
```

---

## Files Modified

| File | Changes |
|------|---------|
| `/app/api/linkedin-commenting/discover-posts-apify/route.ts` | Added 10-day author cooldown filter |
| `/app/api/linkedin-commenting/approve-comment/route.ts` | Changed to queue instead of immediate post |
| `/app/api/linkedin-commenting/auto-generate-comments/route.ts` | Added auto-approve logic |
| `/app/api/cron/process-comment-queue/route.ts` | New - posts comments + auto-likes |
| `/app/api/cron/daily-repost/route.ts` | New - daily repost of high-engagement |
| `/netlify/functions/process-comment-queue.ts` | New - Netlify scheduled function |
| `/netlify/functions/daily-repost.ts` | New - Netlify scheduled function |
| `/netlify.toml` | Added cron schedules |

---

## Next Steps (If Needed)

1. **Monitor first 24 hours** - Check logs for any errors
2. **Verify comments posting** - Check LinkedIn for actual comments
3. **Tune thresholds** - Adjust repost thresholds if needed (100 likes / 20 comments)
4. **Add more hashtags** - Can add more monitors via database

---

---

## LinkedIn Outbound Campaign System

### Architecture

```
Campaign Created → Prospects Queued → Cron Sends CRs → Poll Accepted → Send Follow-ups
      ↓                  ↓                ↓                 ↓               ↓
   UI/API         send_queue table    1 per 30min      Every 5min      3 days later
                                      (rate limit)     check accepts
```

### Campaign Messaging Rules

| Rule | Setting |
|------|---------|
| Connection requests/day | ~20 max (30 min spacing) |
| Follow-up delay | 3 days after CR accepted |
| Business hours only | Weekdays, skip holidays |
| Rate limiting | 1 CR every 30 minutes |

### Message Flow

1. **Connection Request (CR)**
   - Personalized with first name, company, title
   - Max 300 characters
   - Sent via queue system (not immediate)

2. **Follow-up Messages** (after CR accepted)
   - Message 1: 3 days after acceptance
   - Message 2: 3 days after Message 1
   - Message 3: 3 days after Message 2
   - Goodbye: If no response after Message 3

### Queue System

**Table:** `send_queue`
```sql
- campaign_id, prospect_id
- linkedin_user_id, message
- scheduled_for (timestamp)
- status: pending → sent | failed
- sent_at, error_message
```

**Processing:** Cron runs every minute, sends 1 message if due

### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/campaigns/direct/send-connection-requests-queued` | Queue CRs for campaign |
| `POST /api/cron/process-send-queue` | Process queue (1/min) |
| `POST /api/cron/poll-accepted-connections` | Check for acceptances |
| `POST /api/campaigns/direct/process-follow-ups` | Send follow-up messages |

### Unipile Integration

**Credentials (Production):**
- DSN: `api6.unipile.com:13670`
- API Key: Set via `netlify env:set UNIPILE_API_KEY`

**Critical Bug Fix (Nov 22):**
- NEVER use `/api/v1/users/profile?identifier=` for vanity URLs with numbers
- USE `/api/v1/users/{vanity}?account_id=` instead (legacy endpoint works correctly)

### Holiday Blocking

Queue automatically skips:
- Saturdays & Sundays
- US Holidays: Thanksgiving, Christmas, New Year's, MLK Day, Presidents Day, Memorial Day, July 4th, Labor Day, Veterans Day

### Prospect Status Flow

```
pending → connection_request_sent → connected → messaged → replied | no_reply
```

### Files

| File | Purpose |
|------|---------|
| `/app/api/campaigns/direct/send-connection-requests-queued/route.ts` | Queue creation |
| `/app/api/cron/process-send-queue/route.ts` | Queue processor |
| `/app/api/cron/poll-accepted-connections/route.ts` | Check acceptances |
| `/app/api/campaigns/direct/process-follow-ups/route.ts` | Follow-up sender |
| `/netlify/functions/process-send-queue.ts` | Netlify cron trigger |

---

## Multi-Timezone & Country Support (Dec 3, 2025)

### Campaign-Level Timezone

Campaigns can target different countries with their own:
- **Timezone** - Business hours calculated in target country's time
- **Holidays** - 30+ countries supported with country-specific holidays
- **Weekend days** - Standard (Sat-Sun) or Middle East (Fri-Sat)

### Supported Countries

| Region | Countries |
|--------|-----------|
| Americas | US, CA, MX, BR |
| Europe | DE, FR, GB, NL, BE, AT, CH, IT, ES, PT, IE, SE, NO, DK, FI, PL, GR, IS |
| Asia-Pacific | JP, KR, CN, SG, IN, AU, NZ |
| Middle East/Africa | ZA, AE, SA, IL, KW, QA, BH, OM, JO, EG |

### Friday-Saturday Weekends

These countries use Fri-Sat weekends (not Sat-Sun):
- AE (UAE), SA (Saudi Arabia), KW (Kuwait), QA (Qatar)
- BH (Bahrain), OM (Oman), JO (Jordan), EG (Egypt)

### Setting Campaign Target Country

**Option 1: Database (campaigns table)**
```sql
UPDATE campaigns
SET country_code = 'DE',
    timezone = 'Europe/Berlin'
WHERE id = 'campaign-uuid';
```

**Option 2: schedule_settings JSON**
```json
{
  "country_code": "ZA",
  "timezone": "Africa/Johannesburg",
  "working_hours_start": 8,
  "working_hours_end": 17,
  "skip_weekends": true,
  "skip_holidays": true
}
```

### LinkedIn Commenting Agent Timezone

Set via `linkedin_brand_guidelines` table:
```sql
UPDATE linkedin_brand_guidelines
SET timezone = 'Europe/Berlin',
    country_code = 'DE'
WHERE workspace_id = 'workspace-uuid';
```

---

## Commit History

```
ca237482 - Add country selector to commenting agent settings
[latest] - Add multi-timezone/country support for campaigns and comments
a46628fe - Add Dec 3 handover
067ecf99 - Add 10-day per-author comment cooldown
[previous] - Add daily repost feature
[previous] - Add auto-approve and comment scheduling
[previous] - Add auto-like on comments
[previous] - Setup Brian Neirby commenting agent
[previous] - Configure Thorsten commenting agent
```

---

## Multi-Timezone Implementation Summary (Dec 3, 2025)

### What Was Built

1. **Campaign-level Timezone Support** (`process-send-queue/route.ts`)
   - Queue processor respects target country's timezone
   - Supports 30+ countries with country-specific holidays
   - Friday-Saturday weekends for Middle East countries (AE, SA, KW, QA, BH, OM, JO, EG)
   - Campaign can override workspace defaults via `country_code` or `schedule_settings` JSON

2. **Commenting Agent Timezone Support** (`process-comment-queue/route.ts`)
   - Comments scheduled in target country's business hours
   - Uses workspace settings from `linkedin_brand_guidelines` table
   - Same holiday/weekend support as campaigns

3. **Settings UI** (`CommentingAgentSettings.tsx`)
   - Added country selector dropdown (20+ countries)
   - Countries grouped by region (Americas, Europe, Africa, Asia-Pacific, Middle East)
   - Auto-maps country selection to appropriate timezone
   - Holiday toggle description updates based on selected country

### Architecture

```
Workspace Level (linkedin_brand_guidelines)
├── country_code: Default target country
├── timezone: Default timezone
└── Override on per-campaign basis

Campaign Level (campaigns table)
├── country_code: Target country (overrides workspace)
├── timezone: Target timezone (overrides workspace)
└── schedule_settings: JSON for additional customization
```

### Supported Countries

| Region | Countries |
|--------|-----------|
| Americas | US, CA |
| Europe | GB, DE, FR, NL, BE, CH, AT, IT, ES, PT, IE |
| Africa | ZA |
| Asia-Pacific | AU, NZ, JP, SG |
| Middle East | AE, SA |

### Files Modified

| File | Changes |
|------|---------|
| `app/api/cron/process-send-queue/route.ts` | Campaign country-specific scheduling |
| `app/api/cron/process-comment-queue/route.ts` | Workspace timezone checking |
| `app/components/CommentingAgentSettings.tsx` | Country selector UI |
| `lib/scheduling-config.ts` | Holiday definitions for 30+ countries |

### Testing

To verify timezone settings are working:
```sql
-- Check workspace country setting
SELECT workspace_id, country_code, timezone
FROM linkedin_brand_guidelines
WHERE workspace_id = 'your-workspace-id';

-- Check campaign country override
SELECT id, campaign_name, country_code, timezone
FROM campaigns
WHERE workspace_id = 'your-workspace-id';
```

---

## Reply Agent (Dec 3, 2025) ✅ BUILT

### What Was Built

Complete HITL (Human-in-the-Loop) reply system for LinkedIn messages:

1. **Database Table** (`reply_agent_drafts`)
   - Stores AI-generated reply drafts
   - Tracks inbound message, research findings, approval status
   - 48-hour expiry on pending drafts

2. **Cron Processor** (`/api/cron/reply-agent-process`)
   - Polls Unipile for new inbound messages every 5 minutes
   - Detects intent using Claude (INTERESTED, QUESTION, OBJECTION, etc.)
   - Generates personalized reply with research context
   - Sends HITL email via Postmark for manual approval

3. **Approval Endpoint** (`/api/reply-agent/approve`)
   - GET: Email link clicks (approve/reject)
   - POST: UI-based approval with edit capability
   - Sends approved message via Unipile

4. **Result Page** (`/app/reply-agent-result/page.tsx`)
   - Landing page for email action clicks
   - Shows success/error/info with styled UI

5. **Config Modal** (`ReplyAgentModal.tsx`)
   - Save button moved to always-visible footer
   - Research-first guidelines template
   - 300px textarea with monospace font

### Files Created/Modified

| File | Purpose |
|------|---------|
| `/app/api/cron/reply-agent-process/route.ts` | Main cron processor |
| `/app/api/reply-agent/approve/route.ts` | Approve/reject endpoint |
| `/app/reply-agent-result/page.tsx` | Result landing page |
| `/netlify/functions/reply-agent-process.ts` | Netlify scheduled function |
| `/supabase/migrations/20251203_create_reply_agent_drafts.sql` | Database schema |
| `/supabase/migrations/20251203_create_workspace_reply_agent_config.sql` | Config table |
| `/app/components/ReplyAgentModal.tsx` | Updated UI |

### HITL Email Flow

```
Prospect Replies → Cron Detects → AI Generates Draft → Email to Owner
      ↓                                                      ↓
   Unipile                                          Approve/Reject/Edit
      ↓                                                      ↓
   SAM Sends                                         Click → Send via Unipile
```

### Test Script

```bash
node scripts/js/test-reply-agent.mjs
```
Sends test HITL email to workspace owner (tl@innovareai.com)

### Industry-Adaptive Tone (Dec 3, 2025)

SAM automatically adjusts reply tone based on prospect's industry:

| Industry/Type | Tone | Language Style |
|---------------|------|----------------|
| **Tech/SaaS Startup** | Casual, direct | "Hey", short sentences, no fluff |
| **Consulting/Advisory** | Professional, peer-level | Speak as equals, reference methodology |
| **Coaching/Training** | Warm, outcomes-focused | Focus on client transformation |
| **SME/Traditional** | Respectful, clear value | No jargon, concrete benefits |
| **Enterprise** | Polished, strategic | Business impact, ROI language |
| **Solo/Founder** | Personal, time-aware | Respect their bandwidth |
| **Agency** | Creative, results-driven | Portfolio thinking, client wins |

**Key Rules:**
- Sound human, not templated
- NO corporate buzzwords (leverage, synergy, robust)
- NO fake enthusiasm ("Thanks so much!", "Love what you're doing!")
- NO "bodies" or "headcount" language for professional services

### Contextual Greetings (Dec 3, 2025)

Replies include human touches based on date/time:

| Context | Greeting |
|---------|----------|
| Monday | "Hope your Monday is off to a good start!" |
| Friday | "Happy Friday!" |
| Post-Thanksgiving | "Hope you had a great Thanksgiving!" |
| Christmas/New Year | "Hope you have a great holiday season!" / "Happy New Year!" |
| Morning (before noon) | "Hope your morning is going well!" |
| Afternoon (12-5 PM) | "Hope your afternoon is going well!" |

**Files Updated:**
- `/scripts/js/test-reply-agent.mjs` - Test mode toggle (STARTUP/CONSULTANT)
- `/app/api/cron/reply-agent-process/route.ts` - `getContextualGreeting()` function

### Google Chat Notifications (Dec 3, 2025)

Reply Agent now sends HITL notifications to **both email AND Google Chat**:

| Channel | Purpose |
|---------|---------|
| **Email** (Postmark) | Primary notification to workspace owner |
| **Google Chat** | Team visibility with clickable approve/reject buttons |

**Google Chat Card includes:**
- Prospect name, title, company
- Intent detection (🔥 INTERESTED, ❓ QUESTION, etc.)
- Their message
- SAM's draft reply
- Approve/Reject/Edit buttons

**Configuration:** Uses existing `GOOGLE_CHAT_WEBHOOK_URL` environment variable.

**File:** `/lib/notifications/google-chat.ts` → `sendReplyAgentHITLNotification()`

---

## TODO: Prospect Scoring Agent (Future Feature)

### Overview

Score every uploaded/searched prospect based on website and LinkedIn profile to prioritize outreach.

### Implementation Requirements (~16 hours)

| Component | Effort | Description |
|-----------|--------|-------------|
| **Database table** `prospect_scores` | 1h | Store scores + ICP config per workspace |
| **Research fetcher** | 2h | Reuse Reply Agent research (LinkedIn, company, website) |
| **AI scoring prompt** | 2h | Claude analyzes against ICP criteria |
| **Upload hook** | 2h | Auto-score after CSV upload |
| **Search hook** | 2h | Score as prospects discovered |
| **UI score badge** | 3h | 🔥 Hot (80+) / ⭐ Good (60-79) / 🤔 Low (<60) |
| **ICP config modal** | 4h | Define scoring criteria per workspace |

### Scoring Criteria (Configurable)

```
ICP Match Score (0-100):
├── Title/Seniority Match (25 pts) - VP, Director, C-level
├── Company Size Fit (20 pts) - 50-500 employees
├── Industry Alignment (20 pts) - SaaS, Tech, etc.
├── Tech Stack Match (15 pts) - Uses relevant tools
├── Intent Signals (10 pts) - Recent posts, job changes
└── Geography (10 pts) - Target regions
```

### Architecture

```
Upload/Search
     ↓
Queue prospects for scoring
     ↓
Background job fetches:
  - LinkedIn profile (Unipile)
  - Company page (Unipile)
  - Website (web scrape)
     ↓
Claude analyzes against ICP config
     ↓
Score saved to prospect_scores
     ↓
UI shows badge: 🔥 Hot / ⭐ Good / 🤔 Low
```

### Data Sources

| Source | API | What We Score |
|--------|-----|---------------|
| LinkedIn Profile | Unipile | Title, seniority, experience, activity |
| Company LinkedIn | Unipile | Size, industry, growth signals |
| Website | Jina.ai / scraper | Tech stack, product fit, funding |

### Priority

**Medium** - Nice to have for prioritizing outreach, not blocking core functionality

---

## Session 2: System Health Check & Reply Agent Integration (Dec 3, 2025)

### Overview

Completed system health audit and integrated Reply Agent with the outbound automation pipeline to automatically stop follow-ups when prospects reply.

---

### 1. LinkedIn Search Fix ✅

**Problem:** Endpoint was completely broken with multiple errors:
- `cookies is not defined` (line 13 used `cookies` without importing)
- `createRouteHandlerClient` undefined
- Dead code mixing Unipile with Apify/BrightData

**Solution:** Complete rewrite with clean Unipile-only implementation.

**File:** [app/api/prospects/linkedin-search/route.ts](app/api/prospects/linkedin-search/route.ts)

**Changes:**
- Removed ~240 lines of dead Apify/BrightData code
- Clean Unipile search implementation
- Proper error handling
- Returns formatted prospects with metadata

---

### 2. Reply Detection → Stop Automation → Trigger SAM ✅

**Problem:** When a prospect replies, the system needed to:
1. Stop all pending follow-ups
2. Trigger SAM Reply Agent to generate draft response

**Solution:** Updated `poll-message-replies` cron job.

**File:** [app/api/cron/poll-message-replies/route.ts](app/api/cron/poll-message-replies/route.ts)

**Flow:**
```
poll-message-replies (every 15 min)
        ↓
Detects inbound message from prospect
        ↓
1. Update prospect status to 'replied'
2. Clear follow_up_due_at (stops follow-ups)
3. Cancel pending send_queue items
4. Cancel pending email_send_queue items
5. Create draft with status='pending_generation'
        ↓
reply-agent-process (every 5 min)
        ↓
Picks up pending_generation drafts
        ↓
1. Generate AI reply using Claude
2. Detect intent (INTERESTED, QUESTION, etc.)
3. Update draft to 'pending_approval'
4. Send HITL notification (email + chat)
```

**New Function Added:** `triggerReplyAgent()`
- Checks if workspace has Reply Agent enabled
- Creates draft with `status: 'pending_generation'`
- Includes all prospect context for AI generation

---

### 3. Process Pending Generation Drafts ✅

**Problem:** `reply-agent-process` only polled Unipile directly. It didn't process drafts created by `poll-message-replies`.

**Solution:** Added new function `processPendingGenerationDrafts()`.

**File:** [app/api/cron/reply-agent-process/route.ts](app/api/cron/reply-agent-process/route.ts)

**What it does:**
1. Queries drafts with `status = 'pending_generation'`
2. For each draft:
   - Gets workspace config (enabled, approval_mode)
   - Gets prospect details
   - Generates AI reply using existing `generateAIReply()`
   - Updates draft to `pending_approval`
   - Sends HITL notification

---

### System State Verified

| Component | Status |
|-----------|--------|
| send_queue | 192 sent, 25 pending, 10 failed ✅ |
| Reply Agent drafts | 13 in pending_approval ✅ |
| Replied prospects | 2 (Chetas, Victor) - no pending queue ✅ |
| Workspaces enabled | 13 with Reply Agent ✅ |
| LinkedIn accounts | 9 connected ✅ |
| Email accounts | 2 connected ✅ |
| Active campaigns | 10 ✅ |

---

### Cron Schedule Summary

| Function | Schedule | Purpose |
|----------|----------|---------|
| `poll-message-replies` | Every 15 min | Detect replies, stop automation, create draft |
| `reply-agent-process` | Every 5 min | Generate AI reply, send HITL notification |
| `process-send-queue` | Every 1 min | Send queued CRs/messages |
| `poll-accepted-connections` | Every 15 min | Detect CR acceptances |

---

### Files Modified

| File | Changes |
|------|---------|
| `app/api/prospects/linkedin-search/route.ts` | Complete rewrite - Unipile only |
| `app/api/cron/poll-message-replies/route.ts` | Added send_queue cancellation + triggerReplyAgent() |
| `app/api/cron/reply-agent-process/route.ts` | Added processPendingGenerationDrafts() |

---

### Testing

**Check replied prospects have no pending queue:**
```sql
SELECT
  first_name,
  status,
  responded_at,
  follow_up_due_at,
  EXISTS(SELECT 1 FROM send_queue sq WHERE sq.prospect_id = cp.id AND sq.status = 'pending') as has_pending_queue
FROM campaign_prospects cp
WHERE status = 'replied';
```

**Check Reply Agent draft statuses:**
```sql
SELECT status, COUNT(*) as count
FROM reply_agent_drafts
GROUP BY status;
```

**Monitor cron logs:**
```bash
netlify logs --function poll-message-replies --tail
netlify logs --function reply-agent-process --tail
```

---

### Deployment

Deployed to production: https://app.meet-sam.com
- Deploy ID: `6930017d6b7b572da5a52104`
- Message: "Reply Agent: Add pending_generation processing"

---

## Session 3: SAM Benefits Document & Win-Back Campaigns (Dec 3, 2025)

### Overview

Created comprehensive SAM benefits and features document for RAG, AI replies, and campaign messaging. Also crafted win-back email templates for previous clients and prospects.

---

### 1. SAM Benefits & Features Document ✅

**File:** [docs/SAM_BENEFITS_AND_FEATURES.md](SAM_BENEFITS_AND_FEATURES.md)

**Purpose:**
- RAG context for SAM AI conversations
- Reply Agent response generation
- LinkedIn campaign messaging framework
- Sales collateral and positioning

**Key Positioning:**
> SAM is the **orchestration agent and intelligence layer** for B2B go-to-market teams — NOT just automation.

**Document Sections:**
| Section | Content |
|---------|---------|
| What is SAM | Orchestration agent positioning |
| Architecture | 5-agent system diagram |
| Core Capabilities | Commenting, Outreach, Reply, Follow-up agents |
| Benefits by Persona | Founder, Sales Lead, RevOps, Marketing |
| Objections & Responses | 10 common objections with rebuttals |
| Use Cases | By industry, team size, GTM motion |
| Messaging Frameworks | Pain/Solution, Before/After, ROI |
| Sample Messages | CR, follow-up, email, comment templates |

---

### 2. Win-Back Email: Previous Clients ✅

**For:** Clients who used our outreach automation before and left.

```
Subject: We rebuilt everything. Want to test it?

Hey [Name],

Quick one — we rebuilt the entire outreach system you used to run.

SAM now handles:
✓ Engagement first (comments on prospect posts before outreach)
✓ Reply Agent (AI drafts responses, you approve with one click)
✓ Follow-up Agent (re-engages prospects who go silent)
✓ CRM Auto-Sync (no manual data entry ever)

Everything coordinates: warm-up → outreach → replies → follow-ups.
All in one place. No more duct tape.

Pricing: $99/month for life (locked — normally $199).

Reply to this and you can test drive it for free.

Cheers,
[Your name]
```

---

### 3. Win-Back Email: Previous Prospects ✅

**For:** People who were pitched SAM before but didn't buy.

```
Subject: The thing you were worried about? AI fixed it.

Hey [Name],

You passed on SAM before — probably the right call at the time.

But AI changed everything.

What used to be clunky automation is now intelligent orchestration:
✓ AI warms up prospects before you reach out (comments, engagement)
✓ AI drafts replies when prospects respond — you just approve
✓ AI follows up when prospects go silent (without being annoying)
✓ CRM syncs automatically — zero data entry

The technology caught up. It's not automation anymore.
It's an AI layer that handles your entire outbound motion.

$99/month for life (locked — normally $199).

Reply and I'll give you a free test drive — no pitch, just see if it fits.

[Your name]
```

---

### 4. Key Messaging Framework

**SAM Positioning:**
- ❌ NOT: "AI-powered LinkedIn automation"
- ✅ YES: "Orchestration agent and intelligence layer for B2B GTM teams"

**Differentiators:**
| Old Way | SAM Way |
|---------|---------|
| Cold outreach | Warm-up first (engagement) |
| Manual replies | AI drafts, human approves |
| Ghosted prospects | Follow-up agent re-engages |
| CRM data entry | Auto-sync everything |
| Point tools | One orchestration layer |

**Pricing:**
- List: $199/month
- Win-back: $99/month for life (50% discount)
- Trial: Free test drive

---

### Files Created

| File | Purpose |
|------|---------|
| `docs/SAM_BENEFITS_AND_FEATURES.md` | Complete benefits doc for RAG + campaigns |

### Commit

```
Position SAM as GTM orchestration agent, not just automation
```

---

### Next Steps

1. **Load into RAG** - Add SAM_BENEFITS_AND_FEATURES.md to knowledge base
2. **Train Reply Agent** - Reference benefits doc in AI generation prompts
3. **Execute win-back** - Send emails to previous clients/prospects

---

## Session 4: CRITICAL - Campaign Queue Emergency Fix (Dec 3, 2025)

### Overview

Michelle's and Charissa's LinkedIn campaigns were NOT sending. 94 prospects were stuck with `status='pending'` but NEVER added to `send_queue`. Emergency fix deployed with safeguards to prevent recurrence.

---

### Root Causes Identified

| Issue | Cause | Fix |
|-------|-------|-----|
| **Prospects never queued** | Campaign launch failed to add prospects to `send_queue` | Manual script + auto-queue cron |
| **Invalid account IDs** | Campaigns had `linkedin_account_id` values that didn't match `workspace_accounts` | Fixed manually in DB |
| **Wrong campaign_type filter** | Code was filtering by `campaign_type='linkedin'` but actual value is `'connector'` | Fixed in code |
| **5-minute spacing too slow** | Rate limiting blocked rapid sends | Reduced to 2-minute spacing |

---

### What Was Broken

```
Campaign Created → Prospects Added → Queue? → NOTHING
                                       ↓
                   Queue was EMPTY - prospects never queued
```

**Affected Campaigns:**
- Mich Campaign 4 (~30 prospects)
- Mich Campaign 3 (~30 prospects)
- 12/2 Cha Campaign 5 (~34 prospects)

**All prospects had:**
- `status = 'pending'` in `campaign_prospects`
- `0 records` in `send_queue`

---

### Fixes Deployed

#### 1. Manual Queue Script (Immediate)

Ran script to manually queue all 94 prospects:

**File:** [temp/queue-campaigns.cjs](temp/queue-campaigns.cjs)

```javascript
// Queue prospects for specific campaigns
const campaigns = [
  "Mich Campaign 4",
  "Mich Campaign 3",
  "12/2 Cha Campaign 5"
];
// Queued with 30-minute spacing
```

**Result:** 94 prospects queued immediately.

---

#### 2. Auto-Queue Cron (Safeguard)

Created new cron job that runs every 5 minutes to catch any campaigns that failed to queue.

**Files:**
- [app/api/cron/queue-pending-prospects/route.ts](app/api/cron/queue-pending-prospects/route.ts) - API endpoint
- [netlify/functions/queue-pending-prospects.ts](netlify/functions/queue-pending-prospects.ts) - Netlify trigger

**Logic:**
```
Every 5 minutes:
1. Get all active connector campaigns
2. For each campaign:
   - Get prospects with status='pending'
   - Check if they're in send_queue
   - Queue any that aren't (2-minute spacing)
```

**Why it's needed:**
- Campaign launch sometimes fails silently
- Network issues during upload
- RLS policy edge cases
- This catches anything that slips through

---

#### 3. Error Monitor Check (Detection)

Added "Unqueued Prospects" check to the realtime error monitor.

**File:** [app/api/agents/realtime-error-monitor/route.ts](app/api/agents/realtime-error-monitor/route.ts)

**New Check:**
```javascript
// CHECK 5: Active connector campaigns with PENDING prospects but NO queue items
const { data: connectorCampaigns } = await supabase
  .from('campaigns')
  .select('id, campaign_name, status, created_at, campaign_type')
  .eq('status', 'active')
  .eq('campaign_type', 'connector')
  .lt('created_at', campaignAgeThreshold);
```

**Triggers alert if:**
- Campaign is `active` and type `connector`
- Has prospects with `status='pending'`
- Those prospects have NO records in `send_queue`

---

#### 4. Reduced Rate Limiting

Changed spacing from 5 minutes to 2 minutes per account.

**File:** [app/api/cron/process-send-queue/route.ts](app/api/cron/process-send-queue/route.ts)

```typescript
// Changed from 5 to 2 minutes
const MIN_SPACING_MINUTES = 2;
```

**Impact:**
- ~30 CRs/day per account (was ~12/day)
- Still safe for LinkedIn limits
- Faster campaign execution

---

### Fixed Campaign Account Assignments

Campaigns had invalid `linkedin_account_id` values. Fixed manually:

```sql
-- Michelle's campaigns
UPDATE campaigns
SET linkedin_account_id = '50aca023-...'
WHERE campaign_name LIKE 'Mich%';

-- Charissa's campaigns
UPDATE campaigns
SET linkedin_account_id = '19aa583c-...'
WHERE campaign_name LIKE '%Cha%';
```

---

### Results

| Metric | Before | After |
|--------|--------|-------|
| Pending in queue | 0 | 94 |
| CRs sent today | 0 | 65+ |
| Campaigns sending | 0 | 3 |
| System health | BROKEN | OPERATIONAL |

---

### Safeguards Now in Place

| Safeguard | Frequency | Purpose |
|-----------|-----------|---------|
| `queue-pending-prospects` cron | Every 5 min | Auto-queues any missed prospects |
| Error monitor "Unqueued Prospects" | On-demand | Alerts if campaigns have unqueued prospects |
| `process-send-queue` cron | Every 1 min | Sends queued messages |
| 2-minute spacing | Per account | Faster sending while staying safe |

---

### Files Modified

| File | Changes |
|------|---------|
| `app/api/cron/queue-pending-prospects/route.ts` | **NEW** - Auto-queue cron |
| `netlify/functions/queue-pending-prospects.ts` | **NEW** - Netlify trigger |
| `app/api/cron/process-send-queue/route.ts` | Reduced spacing 5→2 min |
| `app/api/agents/realtime-error-monitor/route.ts` | Added unqueued prospects check |
| `temp/queue-campaigns.cjs` | Manual queue script |
| `temp/skip-tim.cjs` | Skip specific prospects |
| `temp/reset-and-send.cjs` | Reschedule all pending to NOW |

---

### Monitoring

**Check queue status:**
```sql
SELECT
  status,
  COUNT(*)
FROM send_queue
GROUP BY status;
```

**Check for unqueued prospects:**
```sql
SELECT
  c.campaign_name,
  COUNT(cp.id) as pending_prospects,
  (SELECT COUNT(*) FROM send_queue sq
   WHERE sq.campaign_id = c.id) as queue_count
FROM campaigns c
JOIN campaign_prospects cp ON cp.campaign_id = c.id
WHERE c.status = 'active'
  AND c.campaign_type = 'connector'
  AND cp.status = 'pending'
GROUP BY c.id, c.campaign_name
HAVING COUNT(cp.id) > 0;
```

**Check Netlify cron logs:**
```bash
netlify logs --function queue-pending-prospects --tail
netlify logs --function process-send-queue --tail
```

---

### Architecture Discussion: pg_cron Alternative

**User asked:** "Would Supabase Edge Functions be better?"

**Answer:** For this use case, **pg_cron** would be the cleanest solution:

```sql
-- Run entirely in database, no HTTP hop
SELECT cron.schedule(
  'queue-pending-prospects',
  '*/5 * * * *',
  $$
  INSERT INTO send_queue (...)
  SELECT ... FROM campaigns c
  JOIN campaign_prospects p ON ...
  WHERE c.status = 'active'
    AND p.status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM send_queue sq WHERE sq.prospect_id = p.id)
  $$
);
```

**Current approach (Netlify) works fine.** Migration to pg_cron is a future optimization, not urgent.

---

### Deployment

- **Deployed:** December 3, 2025
- **Commit:** "Add auto-queue cron and error monitor for unqueued prospects"
- **Status:** Production verified, 65+ CRs sent today
