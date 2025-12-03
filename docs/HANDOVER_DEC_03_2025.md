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

## Commit History

```
a46628fe - Add Dec 3 handover
067ecf99 - Add 10-day per-author comment cooldown
[previous] - Add daily repost feature
[previous] - Add auto-approve and comment scheduling
[previous] - Add auto-like on comments
[previous] - Setup Brian Neirby commenting agent
[previous] - Configure Thorsten commenting agent
```
