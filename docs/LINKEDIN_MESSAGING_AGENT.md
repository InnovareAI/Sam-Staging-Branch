# LinkedIn & Email Messaging Agent - Complete Technical Documentation

**Last Updated:** December 16, 2025
**Status:** Production - Fully Operational
**Total Codebase:** 8,000+ lines across 50+ files

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Queue-Based Execution System](#queue-based-execution-system)
4. [Core API Endpoints](#core-api-endpoints)
5. [Scheduled Functions (Cron Jobs)](#scheduled-functions-cron-jobs)
6. [Database Schema](#database-schema)
7. [Anti-Detection System](#anti-detection-system)
8. [Rate Limiting & Compliance](#rate-limiting--compliance)
9. [Multi-Country Support](#multi-country-support)
10. [Reply Detection & Follow-ups](#reply-detection--follow-ups)
11. [Email Campaign System](#email-campaign-system)
12. [Unipile Integration](#unipile-integration)
13. [Configuration](#configuration)
14. [Troubleshooting](#troubleshooting)

---

## Overview

The LinkedIn & Email Messaging Agent is a queue-based campaign execution system that sends connection requests, follow-up messages, and emails on behalf of users. It's designed for safe, compliant outreach with built-in anti-detection measures.

### Key Features

- **Queue-Based Execution** - Messages queued and sent 1-at-a-time via cron
- **Multi-Channel** - LinkedIn CRs, LinkedIn DMs, Email
- **Rate Limiting** - 20 CRs/day, 50 DMs/day, 40 emails/day per account
- **Business Hours** - Sends only during configurable work hours
- **35+ Countries** - Timezone and holiday support worldwide
- **Anti-Detection** - Random delays, spacing, skip probability
- **Follow-up Automation** - Auto-schedules follow-ups after CR acceptance
- **Reply Detection** - Polls for replies, stops sequence when prospect responds
- **Multi-Tenant** - Workspace-isolated with Supabase RLS

### Critical Architecture Note

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ⚠️ CRITICAL: WHAT WE USE                             │
├─────────────────────────────────────────────────────────────────────────┤
│ ✅ DIRECT Unipile REST API for ALL LinkedIn operations                  │
│ ✅ Queue-based processing (1 message per minute via cron)               │
│ ✅ Netlify Scheduled Functions for cron execution                       │
├─────────────────────────────────────────────────────────────────────────┤
│                    ❌ WHAT WE DO NOT USE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ ❌ N8N - NOT used for campaign execution (legacy, disabled)             │
│ ❌ Inngest - NOT used                                                   │
│ ❌ External workflow orchestrators                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### System Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     MESSAGING AGENT EXECUTION FLOW                       │
└─────────────────────────────────────────────────────────────────────────┘

1. QUEUE CREATION (API - Instant)
   ┌──────────────────┐
   │ User triggers    │
   │ campaign start   │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐     Validates prospects, creates
   │ /api/campaigns/  │ ──► N records in send_queue table
   │ direct/send-*    │     Returns in <2 seconds
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │   send_queue     │  status: 'pending'
   │   (N records)    │  scheduled_for: staggered times
   └────────┬─────────┘

2. PROCESSING (Cron - Every Minute)
            │
            ▼
   ┌──────────────────┐
   │ process-send-    │ ◄── Netlify calls every minute
   │ queue cron       │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ Select 1 due     │  WHERE scheduled_for <= NOW()
   │ message          │  AND status = 'pending'
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ Validate:        │  • Business hours?
   │ • Rate limits    │  • Weekend/holiday?
   │ • Spacing        │  • Daily limit reached?
   │ • Account health │  • LinkedIn warning?
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ Send via         │ ──► Unipile REST API
   │ Unipile API      │     POST /api/v1/users/invite
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ Update records:  │  send_queue.status = 'sent'
   │ • send_queue     │  prospect.status = 'connection_request_sent'
   │ • prospect       │  linkedin_messages (log)
   └──────────────────┘

3. ACCEPTANCE POLLING (Every 15 min)
   ┌──────────────────┐
   │ poll-accepted-   │ ──► Check Unipile for accepted CRs
   │ connections      │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ If accepted:     │  Schedule follow-up for
   │ • Update status  │  next business day
   │ • Queue follow-up│
   └──────────────────┘

4. FOLLOW-UP PROCESSING (Every 30 min)
   ┌──────────────────┐
   │ send-follow-ups  │ ──► Process due follow-ups
   │ cron             │     via Unipile messages API
   └──────────────────┘

5. REPLY DETECTION (Every 15 min)
   ┌──────────────────┐
   │ poll-message-    │ ──► Check for prospect replies
   │ replies          │     Stop sequence if replied
   └──────────────────┘
```

---

## Architecture

### Directory Structure

```
/app/api/campaigns/
├── direct/                           # Direct Unipile API endpoints
│   ├── send-connection-requests/     # CR queue creation (DISABLED - redirects to fast)
│   ├── send-connection-requests-fast/# FAST CR queue creation
│   ├── send-messages-queued/         # DM queue creation (for connected prospects)
│   └── process-follow-ups/           # Follow-up message processing
├── email/                            # Email campaign endpoints
│   ├── send-emails-queued/           # Email queue creation
│   ├── execute/                      # Legacy direct send
│   └── reachinbox/                   # ReachInbox integration
├── [id]/                             # Campaign CRUD
│   ├── route.ts                      # Get/update/delete
│   └── prospects/                    # Campaign prospects
├── route.ts                          # List/create campaigns
├── activate/                         # Activate campaign
└── upload-prospects/                 # CSV upload

/app/api/cron/
├── process-send-queue/               # Main queue processor (every minute)
├── process-email-queue/              # Email queue processor (every 13 min)
├── send-follow-ups/                  # Follow-up processor (every 30 min)
├── poll-accepted-connections/        # CR acceptance polling (every 15 min)
├── poll-message-replies/             # LinkedIn reply detection (every 15 min)
└── poll-email-replies/               # Email reply detection (every 15 min)

/netlify/functions/
├── process-send-queue.ts             # Cron wrapper for queue processing
├── process-email-queue.ts            # Cron wrapper for email queue
├── send-follow-ups.ts                # Cron wrapper for follow-ups
├── poll-accepted-connections.ts      # Cron wrapper for acceptance polling
├── poll-message-replies.ts           # Cron wrapper for reply detection
└── poll-email-replies.ts             # Cron wrapper for email replies

/lib/
├── services/
│   └── unipile-sender.ts             # Unipile API wrapper
├── anti-detection/
│   ├── message-variance.ts           # Message randomization
│   └── spintax.ts                    # Optional message variation
├── scheduling-config.ts              # 35+ country timezone/holiday support
└── n8n/                              # Legacy N8N client (not used for campaigns)
    ├── n8n-client.ts
    └── webhook-manager.ts

/sql/migrations/
├── 011-create-send-queue-table.sql   # Main message queue
├── 012-create-email-queue-table.sql  # Email queue
├── 035-campaign-messages.sql         # Message tracking
└── 042-linkedin-messages.sql         # LinkedIn message history
```

### Technology Stack

| Component | Technology |
|-----------|------------|
| Queue Processing | Netlify Scheduled Functions (cron) |
| LinkedIn API | Unipile REST API (Direct) |
| Email API | Unipile + ReachInbox |
| Database | Supabase PostgreSQL with RLS |
| Scheduling | Custom timezone/holiday library |
| Frontend | Next.js 15 + React 18 |

---

## Queue-Based Execution System

### Why Queue-Based?

1. **Rate Limit Safety** - Never exceeds LinkedIn limits
2. **Anti-Detection** - Natural spacing between messages
3. **Reliability** - Survives server restarts, retries on failure
4. **Scalability** - Handles thousands of prospects across workspaces
5. **Auditability** - Full history of what was sent when

### Queue Creation Flow

```typescript
// POST /api/campaigns/direct/send-connection-requests-fast
// Creates queue records instantly, returns in <2 seconds

export async function POST(request: NextRequest) {
  const { campaign_id, prospects, message_template } = await request.json();

  // 1. Validate all prospects have LinkedIn URLs
  const validProspects = prospects.filter(p => p.linkedin_url);

  // 2. Calculate scheduled times (30-min spacing)
  const queueRecords = validProspects.map((prospect, index) => ({
    campaign_id,
    prospect_id: prospect.id,
    linkedin_user_id: extractLinkedInId(prospect.linkedin_url),
    message: personalizeMessage(message_template, prospect),
    scheduled_for: calculateScheduledTime(index), // Now + (index * 30 min)
    status: 'pending',
  }));

  // 3. Bulk insert to send_queue
  await supabase.from('send_queue').insert(queueRecords);

  // 4. Return immediately
  return NextResponse.json({
    success: true,
    queued: queueRecords.length,
    estimated_completion: queueRecords[queueRecords.length - 1].scheduled_for,
  });
}
```

### Queue Processing (Every Minute)

```typescript
// POST /api/cron/process-send-queue
// Sends exactly 1 message per execution

export async function POST(request: NextRequest) {
  // 1. Anti-detection: 5% skip probability
  if (Math.random() < 0.05) {
    return NextResponse.json({ skipped: true, reason: 'Random skip' });
  }

  // 2. Random delay (0-45 seconds)
  await randomDelay(0, 45000);

  // 3. Check business hours
  if (!isBusinessHours()) {
    return NextResponse.json({ skipped: true, reason: 'Outside business hours' });
  }

  // 4. Check weekend/holiday
  if (isWeekendOrHoliday()) {
    return NextResponse.json({ skipped: true, reason: 'Weekend or holiday' });
  }

  // 5. Find next due message (across ALL workspaces)
  const { data: message } = await supabase
    .from('send_queue')
    .select('*, campaign:campaigns(*), prospect:campaign_prospects(*)')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(1)
    .single();

  if (!message) {
    return NextResponse.json({ skipped: true, reason: 'No messages due' });
  }

  // 6. Check rate limits for this account
  const dailyCount = await getDailyMessageCount(message.campaign.linkedin_account_id);
  if (dailyCount >= 20) {
    return NextResponse.json({ skipped: true, reason: 'Daily limit reached' });
  }

  // 7. Check spacing (2+ min since last message)
  const lastSent = await getLastSentTime(message.campaign.linkedin_account_id);
  if (Date.now() - lastSent < 2 * 60 * 1000) {
    return NextResponse.json({ skipped: true, reason: 'Spacing not met' });
  }

  // 8. Send via Unipile
  const result = await sendConnectionRequest(
    message.linkedin_user_id,
    message.message,
    message.campaign.linkedin_account_id
  );

  // 9. Update records
  await supabase
    .from('send_queue')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', message.id);

  await supabase
    .from('campaign_prospects')
    .update({ status: 'connection_request_sent', contacted_at: new Date().toISOString() })
    .eq('id', message.prospect_id);

  // 10. Log to linkedin_messages
  await supabase.from('linkedin_messages').insert({
    workspace_id: message.campaign.workspace_id,
    campaign_id: message.campaign_id,
    prospect_id: message.prospect_id,
    direction: 'outgoing',
    message_type: 'connection_request',
    content: message.message,
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, message_id: message.id });
}
```

---

## Core API Endpoints

### LinkedIn Connection Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/campaigns/direct/send-connection-requests-fast` | Queue CRs for campaign |
| POST | `/api/campaigns/direct/send-connection-requests` | Legacy (redirects to fast) |

#### Request Format

```typescript
// POST /api/campaigns/direct/send-connection-requests-fast
{
  "campaign_id": "uuid",
  "prospects": [
    {
      "id": "uuid",
      "linkedin_url": "https://linkedin.com/in/john-doe",
      "first_name": "John",
      "last_name": "Doe",
      "company": "Acme Inc",
      "title": "CEO"
    }
  ],
  "message_template": "Hi {{first_name}}, I noticed you're the {{title}} at {{company}}..."
}
```

#### Response

```typescript
{
  "success": true,
  "queued": 50,
  "estimated_completion": "2025-12-17T14:30:00Z",
  "queue_details": {
    "first_scheduled": "2025-12-16T09:00:00Z",
    "last_scheduled": "2025-12-17T14:30:00Z",
    "spacing_minutes": 30
  }
}
```

### LinkedIn Direct Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/campaigns/direct/send-messages-queued` | Queue DMs to connected prospects |

#### Pre-flight Validation

```typescript
// Only sends to 1st-degree connections
// Validates connection status before queueing

const connectedProspects = prospects.filter(async (p) => {
  const relation = await checkConnectionStatus(p.linkedin_url, accountId);
  return relation.status === 'FIRST_DEGREE';
});
```

### Follow-up Processing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/campaigns/direct/process-follow-ups` | Process due follow-ups |
| POST | `/api/cron/send-follow-ups` | Cron wrapper |

#### Follow-up Logic

```typescript
// Called every 30 minutes by cron
// Processes follow-ups for accepted connections

export async function processFollowUps() {
  // 1. Get prospects with due follow-ups
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*, campaign:campaigns(*)')
    .eq('status', 'connected')  // CR was accepted
    .lte('follow_up_scheduled_for', new Date().toISOString())
    .is('follow_up_sent_at', null);

  for (const prospect of prospects) {
    // 2. Check if prospect has replied (stop sequence)
    if (prospect.replied_at) continue;

    // 3. Get follow-up message template
    const followUpMessage = prospect.campaign.follow_up_template;

    // 4. Anti-detection delays
    await humanLikeDelay(3000, 8000);  // 3-8 second pre-send delay

    // 5. Send via Unipile messages API
    await sendLinkedInMessage(
      prospect.linkedin_provider_id,
      personalizeMessage(followUpMessage, prospect),
      prospect.campaign.linkedin_account_id
    );

    // 6. Update prospect
    await supabase
      .from('campaign_prospects')
      .update({
        status: 'follow_up_sent',
        follow_up_sent_at: new Date().toISOString(),
      })
      .eq('id', prospect.id);
  }
}
```

### Campaign Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List campaigns for workspace |
| POST | `/api/campaigns` | Create new campaign |
| GET | `/api/campaigns/[id]` | Get campaign details |
| PUT | `/api/campaigns/[id]` | Update campaign |
| DELETE | `/api/campaigns/[id]` | Delete campaign |
| POST | `/api/campaigns/activate` | Activate campaign |
| GET | `/api/campaigns/[id]/prospects` | Get campaign prospects |
| POST | `/api/campaigns/upload-prospects` | Upload CSV |

---

## Scheduled Functions (Cron Jobs)

### Overview

| Function | Schedule | Purpose | Rate |
|----------|----------|---------|------|
| `process-send-queue` | Every minute | Send queued LinkedIn messages | 1 msg/min |
| `process-email-queue` | Every 13 min | Send queued emails | ~40/day |
| `send-follow-ups` | Every 30 min | Process follow-up messages | 10/run |
| `poll-accepted-connections` | Every 15 min | Check CR acceptance | All pending |
| `poll-message-replies` | Every 15 min | Detect LinkedIn replies | All active |
| `poll-email-replies` | Every 15 min | Detect email replies | All active |

### netlify.toml Configuration

```toml
# Scheduled function: Process send queue every minute
# Checks ALL workspaces for due messages (each user has 30-min spacing)
# Limits: 20 CRs/day per LinkedIn account, business hours, no weekends/holidays
[functions."process-send-queue"]
  schedule = "* * * * *"

# Scheduled function: Process email queue every 13 minutes
# Compliance: 40 emails/day, 8 AM - 5 PM business hours, no weekends/holidays
[functions."process-email-queue"]
  schedule = "*/13 * * * *"

# Scheduled function: Send follow-up messages every 30 minutes
# Processes connected prospects with due follow-ups (10 per run)
# Compliance: 9 AM - 5 PM business hours, no weekends/holidays
[functions."send-follow-ups"]
  schedule = "*/30 * * * *"

# Scheduled function: Poll for accepted LinkedIn connections every 15 minutes
# Checks if pending CRs have been accepted and schedules follow-ups
# Backup for webhook delays (Unipile webhooks can have 8hr latency)
[functions."poll-accepted-connections"]
  schedule = "*/15 * * * *"

# Scheduled function: Poll for message replies every 15 minutes
# CRITICAL: Backup for new_message webhook - stops follow-ups when prospect replies
[functions."poll-message-replies"]
  schedule = "*/15 * * * *"

# Scheduled function: Poll for EMAIL replies every 15 minutes
# Detects email replies and triggers SAM Reply Agent
[functions."poll-email-replies"]
  schedule = "*/15 * * * *"
```

### process-send-queue Details

**Location:** `/app/api/cron/process-send-queue/route.ts`

```typescript
// Key features:
// - Processes ALL workspaces in single run
// - Sends exactly 1 message per execution
// - Smart message selection with constraint validation
// - LinkedIn warning detection with 24-hour pause

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Anti-detection: 5% random skip
  if (Math.random() < 0.05) {
    console.log('⏭️ Random skip for anti-detection');
    return NextResponse.json({ skipped: true, reason: 'random_skip' });
  }

  // Random delay 0-45 seconds
  const delay = Math.floor(Math.random() * 45000);
  await new Promise(resolve => setTimeout(resolve, delay));

  // Get current time in PT
  const nowPT = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const hour = new Date(nowPT).getHours();
  const day = new Date(nowPT).getDay();

  // Business hours check (5 AM - 5 PM PT)
  if (hour < 5 || hour >= 17) {
    return NextResponse.json({ skipped: true, reason: 'outside_business_hours', hour });
  }

  // Weekend check
  if (day === 0 || day === 6) {
    return NextResponse.json({ skipped: true, reason: 'weekend', day });
  }

  // Holiday check
  if (isHoliday(new Date(), 'US')) {
    return NextResponse.json({ skipped: true, reason: 'holiday' });
  }

  // Find next due message
  const { data: messages } = await supabase
    .from('send_queue')
    .select(`
      *,
      campaign:campaigns(*),
      prospect:campaign_prospects(*)
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(10);  // Get 10, try each until one works

  if (!messages || messages.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no_messages_due' });
  }

  // Try each message until one passes all constraints
  for (const message of messages) {
    const accountId = message.campaign.linkedin_account_id;

    // Check daily limit (20 CRs)
    const dailyCount = await getDailyCount(accountId);
    if (dailyCount >= 20) continue;

    // Check spacing (2 min since last)
    const lastSent = await getLastSentTime(accountId);
    if (Date.now() - new Date(lastSent).getTime() < 120000) continue;

    // Check for LinkedIn warnings
    const hasWarning = await checkLinkedInWarning(accountId);
    if (hasWarning) {
      await pauseAccountFor24Hours(accountId);
      continue;
    }

    // All checks passed - send this message
    try {
      const result = await sendConnectionRequest(
        message.linkedin_user_id,
        message.message,
        accountId
      );

      // Update send_queue
      await supabase
        .from('send_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          unipile_message_id: result.message_id,
        })
        .eq('id', message.id);

      // Update prospect
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'connection_request_sent',
          contacted_at: new Date().toISOString(),
        })
        .eq('id', message.prospect_id);

      // Log to linkedin_messages
      await supabase.from('linkedin_messages').insert({
        workspace_id: message.campaign.workspace_id,
        campaign_id: message.campaign_id,
        prospect_id: message.prospect_id,
        direction: 'outgoing',
        message_type: 'connection_request',
        content: message.message,
        unipile_message_id: result.message_id,
        sent_at: new Date().toISOString(),
      });

      // Log to system_activity_log
      await logActivity('cr_sent', {
        prospect_id: message.prospect_id,
        campaign_id: message.campaign_id,
        account_id: accountId,
      });

      const duration = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        message_id: message.id,
        prospect_id: message.prospect_id,
        duration_ms: duration,
      });

    } catch (error) {
      // Handle rate limit error
      if (error.status === 429) {
        await supabase
          .from('send_queue')
          .update({
            status: 'pending',
            scheduled_for: new Date(Date.now() + 240 * 60 * 1000).toISOString(),
            error_message: 'Rate limited - rescheduled +4 hours',
          })
          .eq('id', message.id);
        continue;
      }

      // Mark as failed
      await supabase
        .from('send_queue')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', message.id);
    }
  }

  return NextResponse.json({ skipped: true, reason: 'all_messages_blocked' });
}
```

---

## Database Schema

### send_queue

Main message queue table.

```sql
CREATE TABLE send_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  prospect_id UUID NOT NULL REFERENCES campaign_prospects(id),

  -- LinkedIn targeting
  linkedin_user_id TEXT NOT NULL,  -- LinkedIn vanity or URN
  linkedin_provider_id TEXT,        -- Unipile provider ID (resolved)

  -- Message content
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'connection_request',  -- 'connection_request', 'message', 'follow_up'

  -- Scheduling
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'sent', 'failed', 'skipped'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Unipile tracking
  unipile_message_id TEXT,
  unipile_chat_id TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(campaign_id, prospect_id, message_type)
);

-- Index for efficient queue polling
CREATE INDEX idx_send_queue_pending ON send_queue(scheduled_for)
  WHERE status = 'pending';

-- Index for rate limit checks
CREATE INDEX idx_send_queue_sent_by_campaign ON send_queue(campaign_id, sent_at)
  WHERE status = 'sent';
```

### email_queue

Email-specific queue table.

```sql
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  campaign_id UUID REFERENCES campaigns(id),
  prospect_id UUID REFERENCES campaign_prospects(id),

  -- Email details
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_timezone TEXT DEFAULT 'America/Los_Angeles',

  -- Content
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,

  -- Scheduling
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,

  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,

  -- Tracking
  tracking_label TEXT,
  email_provider TEXT,  -- 'unipile', 'reachinbox', 'postmark'
  provider_message_id TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);
```

### campaign_prospects

Prospect status tracking.

```sql
CREATE TABLE campaign_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Contact info
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  linkedin_url TEXT,
  linkedin_provider_id TEXT,  -- Resolved Unipile ID

  -- Company info
  company TEXT,
  title TEXT,
  industry TEXT,

  -- Status workflow
  status TEXT DEFAULT 'pending',
  /*
    Status values:
    - 'pending' - Not yet contacted
    - 'connection_request_sent' - CR sent, awaiting acceptance
    - 'connected' - CR accepted
    - 'follow_up_sent' - Follow-up message sent
    - 'replied' - Prospect replied
    - 'not_interested' - Negative reply
    - 'meeting_booked' - Success!
    - 'failed' - Send failed
  */

  -- Timestamps
  contacted_at TIMESTAMP,
  connected_at TIMESTAMP,
  follow_up_scheduled_for TIMESTAMP,
  follow_up_sent_at TIMESTAMP,
  replied_at TIMESTAMP,

  -- Tracking
  last_message_id TEXT,
  last_processed_message_id TEXT,  -- For multi-turn detection

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### linkedin_messages

Message history for auditing.

```sql
CREATE TABLE linkedin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  campaign_id UUID REFERENCES campaigns(id),
  prospect_id UUID REFERENCES campaign_prospects(id),

  -- Message details
  direction TEXT NOT NULL,  -- 'outgoing', 'incoming'
  message_type TEXT NOT NULL,  -- 'connection_request', 'message', 'follow_up', 'reply'
  content TEXT NOT NULL,

  -- LinkedIn IDs
  unipile_message_id TEXT,
  unipile_chat_id TEXT,
  linkedin_message_urn TEXT,

  -- Timestamps
  sent_at TIMESTAMP,
  received_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### RLS Policies

```sql
-- Workspace isolation for send_queue
CREATE POLICY "Users can view their workspace queue"
  ON send_queue FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Service role for cron jobs
CREATE POLICY "Service role manages queue"
  ON send_queue FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

---

## Anti-Detection System

### Message Variance

**Location:** `/lib/anti-detection/message-variance.ts`

```typescript
interface MessageVariance {
  preDelay: number;      // Delay before sending (ms)
  composingDelay: number; // Simulated typing time (ms)
  followUpVariance: number; // Days to add/subtract from follow-up
}

// Calculate human-like delays
export function getMessageVariance(messageLength: number): MessageVariance {
  // Pre-send delay: 3-8 seconds
  const preDelay = randomBetween(3000, 8000);

  // Composing delay based on message length
  // ~50ms per character (human typing speed)
  const baseComposing = messageLength * 50;
  const composingDelay = baseComposing + randomBetween(-1000, 2000);

  // Follow-up variance: ±2 days
  const followUpVariance = randomBetween(-2, 2);

  return { preDelay, composingDelay, followUpVariance };
}

// Apply variance to follow-up scheduling
export function getFollowUpDate(baseDate: Date, varianceDays: number): Date {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + varianceDays);

  // Ensure business day
  while (isWeekend(result) || isHoliday(result)) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}
```

### Skip Probability

```typescript
// 5% chance to skip any cron run
const SKIP_PROBABILITY = 0.05;

if (Math.random() < SKIP_PROBABILITY) {
  console.log('⏭️ Random skip for human-like hesitation');
  return { skipped: true };
}
```

### Random Delays

```typescript
// Random delay before processing (0-45 seconds)
const delay = Math.floor(Math.random() * 45000);
await new Promise(resolve => setTimeout(resolve, delay));
```

### Spacing Enforcement

```typescript
// Minimum 2 minutes between messages per account
const MIN_SPACING_MS = 2 * 60 * 1000;

const lastSent = await getLastSentTime(accountId);
if (Date.now() - lastSent < MIN_SPACING_MS) {
  return { skipped: true, reason: 'spacing_not_met' };
}
```

### Spintax Support (Optional)

**Location:** `/lib/anti-detection/spintax.ts`

```typescript
// Optional message variation using spintax
// Only enabled when explicitly configured

// Input: "Hi {John|there}, {great|nice} to connect!"
// Output: "Hi John, nice to connect!" (randomly selected)

export function processSpintax(text: string): string {
  return text.replace(/\{([^}]+)\}/g, (match, options) => {
    const choices = options.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}
```

---

## Rate Limiting & Compliance

### LinkedIn Limits

| Limit | Value | Enforcement |
|-------|-------|-------------|
| CRs per day | 20 | Daily counter per account |
| CRs per week | 100 | Weekly counter per account |
| DMs per day | 50 | Daily counter per account |
| Min spacing | 2 min | Between any messages |
| Queue spacing | 30 min | Between queued prospects |

### Business Hours

```typescript
// Default: 5 AM - 5 PM Pacific Time
const BUSINESS_HOURS = {
  start: 5,   // 5 AM
  end: 17,    // 5 PM
  timezone: 'America/Los_Angeles',
};

function isBusinessHours(): boolean {
  const now = new Date().toLocaleString('en-US', {
    timeZone: BUSINESS_HOURS.timezone,
  });
  const hour = new Date(now).getHours();
  return hour >= BUSINESS_HOURS.start && hour < BUSINESS_HOURS.end;
}
```

### Weekend Blocking

```typescript
function isWeekend(): boolean {
  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
  });
  const day = new Date(now).getDay();
  return day === 0 || day === 6;  // Sunday or Saturday
}

// Special handling for Middle East (Friday-Saturday weekend)
function isWeekendForCountry(country: string): boolean {
  const fridaySaturdayCountries = ['AE', 'SA', 'KW', 'BH', 'QA', 'OM'];
  const day = new Date().getDay();

  if (fridaySaturdayCountries.includes(country)) {
    return day === 5 || day === 6;  // Friday or Saturday
  }
  return day === 0 || day === 6;  // Sunday or Saturday
}
```

### Holiday Blocking

```typescript
// US Holidays (2025-2026)
const US_HOLIDAYS = [
  '2025-01-01',  // New Year's Day
  '2025-01-20',  // MLK Day
  '2025-02-17',  // Presidents Day
  '2025-05-26',  // Memorial Day
  '2025-07-04',  // Independence Day
  '2025-09-01',  // Labor Day
  '2025-11-11',  // Veterans Day
  '2025-11-27',  // Thanksgiving
  '2025-12-25',  // Christmas
  // ... 2026 holidays
];

function isHoliday(date: Date, country: string = 'US'): boolean {
  const holidays = getHolidaysForCountry(country);
  const dateStr = date.toISOString().split('T')[0];
  return holidays.includes(dateStr);
}
```

### LinkedIn Warning Detection

```typescript
// Check for LinkedIn restriction warnings
async function checkLinkedInWarning(accountId: string): Promise<boolean> {
  const { data: account } = await supabase
    .from('linkedin_accounts')
    .select('warning_detected_at, warning_type')
    .eq('id', accountId)
    .single();

  if (!account?.warning_detected_at) return false;

  // Check if warning is within 24 hours
  const warningTime = new Date(account.warning_detected_at);
  const hoursSinceWarning = (Date.now() - warningTime.getTime()) / (1000 * 60 * 60);

  return hoursSinceWarning < 24;
}

// Pause account for 24 hours on warning
async function pauseAccountFor24Hours(accountId: string): Promise<void> {
  await supabase
    .from('linkedin_accounts')
    .update({
      paused_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      pause_reason: 'LinkedIn warning detected',
    })
    .eq('id', accountId);
}
```

---

## Multi-Country Support

### Supported Countries (35+)

**Location:** `/lib/scheduling-config.ts`

```typescript
export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  // North America
  US: { timezone: 'America/Los_Angeles', weekendDays: [0, 6], holidays: US_HOLIDAYS },
  CA: { timezone: 'America/Toronto', weekendDays: [0, 6], holidays: CA_HOLIDAYS },
  MX: { timezone: 'America/Mexico_City', weekendDays: [0, 6], holidays: MX_HOLIDAYS },

  // Europe
  GB: { timezone: 'Europe/London', weekendDays: [0, 6], holidays: GB_HOLIDAYS },
  DE: { timezone: 'Europe/Berlin', weekendDays: [0, 6], holidays: DE_HOLIDAYS },
  FR: { timezone: 'Europe/Paris', weekendDays: [0, 6], holidays: FR_HOLIDAYS },
  ES: { timezone: 'Europe/Madrid', weekendDays: [0, 6], holidays: ES_HOLIDAYS },
  IT: { timezone: 'Europe/Rome', weekendDays: [0, 6], holidays: IT_HOLIDAYS },
  NL: { timezone: 'Europe/Amsterdam', weekendDays: [0, 6], holidays: NL_HOLIDAYS },
  IE: { timezone: 'Europe/Dublin', weekendDays: [0, 6], holidays: IE_HOLIDAYS },

  // Middle East (Friday-Saturday weekend)
  AE: { timezone: 'Asia/Dubai', weekendDays: [5, 6], holidays: AE_HOLIDAYS },
  SA: { timezone: 'Asia/Riyadh', weekendDays: [5, 6], holidays: SA_HOLIDAYS },
  IL: { timezone: 'Asia/Jerusalem', weekendDays: [5, 6], holidays: IL_HOLIDAYS },

  // Asia Pacific
  AU: { timezone: 'Australia/Sydney', weekendDays: [0, 6], holidays: AU_HOLIDAYS },
  NZ: { timezone: 'Pacific/Auckland', weekendDays: [0, 6], holidays: NZ_HOLIDAYS },
  SG: { timezone: 'Asia/Singapore', weekendDays: [0, 6], holidays: SG_HOLIDAYS },
  JP: { timezone: 'Asia/Tokyo', weekendDays: [0, 6], holidays: JP_HOLIDAYS },
  IN: { timezone: 'Asia/Kolkata', weekendDays: [0, 6], holidays: IN_HOLIDAYS },

  // ... 15+ more countries
};
```

### Holiday Lists (2025-2026)

```typescript
export const US_HOLIDAYS_2025 = [
  '2025-01-01',  // New Year's Day
  '2025-01-20',  // MLK Day
  '2025-02-17',  // Presidents Day
  '2025-05-26',  // Memorial Day
  '2025-07-04',  // Independence Day
  '2025-09-01',  // Labor Day
  '2025-11-11',  // Veterans Day
  '2025-11-27',  // Thanksgiving
  '2025-11-28',  // Day after Thanksgiving
  '2025-12-25',  // Christmas
  '2025-12-26',  // Day after Christmas
];

export const GB_HOLIDAYS_2025 = [
  '2025-01-01',  // New Year's Day
  '2025-04-18',  // Good Friday
  '2025-04-21',  // Easter Monday
  '2025-05-05',  // Early May Bank Holiday
  '2025-05-26',  // Spring Bank Holiday
  '2025-08-25',  // Summer Bank Holiday
  '2025-12-25',  // Christmas
  '2025-12-26',  // Boxing Day
];

// ... holidays for all 35+ countries
```

### Usage in Queue Processing

```typescript
// Get prospect's country from their profile or campaign settings
const country = prospect.country || campaign.default_country || 'US';
const config = COUNTRY_CONFIGS[country];

// Check if it's a working day for this prospect
function isWorkingDay(date: Date, country: string): boolean {
  const config = COUNTRY_CONFIGS[country];
  const day = date.getDay();

  // Check weekend
  if (config.weekendDays.includes(day)) return false;

  // Check holiday
  const dateStr = date.toISOString().split('T')[0];
  if (config.holidays.includes(dateStr)) return false;

  return true;
}

// Schedule for next business day if needed
function scheduleForNextBusinessDay(date: Date, country: string): Date {
  let scheduled = new Date(date);
  while (!isWorkingDay(scheduled, country)) {
    scheduled.setDate(scheduled.getDate() + 1);
  }
  return scheduled;
}
```

---

## Reply Detection & Follow-ups

### Connection Acceptance Polling

**Location:** `/app/api/cron/poll-accepted-connections/route.ts`

```typescript
// Runs every 15 minutes
// Backup for Unipile webhook (can have 8hr latency)

export async function POST(request: NextRequest) {
  // 1. Get all prospects with pending CRs
  const { data: pendingProspects } = await supabase
    .from('campaign_prospects')
    .select('*, campaign:campaigns(*)')
    .eq('status', 'connection_request_sent')
    .lt('contacted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());  // CR sent 24h+ ago

  for (const prospect of pendingProspects) {
    const accountId = prospect.campaign.linkedin_account_id;

    // 2. Check pending invitations (to detect withdrawals/declines)
    const pendingInvites = await fetchPendingInvitations(accountId);
    const stillPending = pendingInvites.some(inv =>
      inv.profile_url.includes(prospect.linkedin_url)
    );

    if (stillPending) continue;  // Still waiting

    // 3. Check confirmed connections (to detect acceptance)
    const connections = await fetchConnections(accountId);
    const isConnected = connections.some(conn =>
      conn.profile_url.includes(prospect.linkedin_url)
    );

    if (isConnected) {
      // 4. Update prospect status
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'connected',
          connected_at: new Date().toISOString(),
          follow_up_scheduled_for: scheduleFollowUp(prospect),  // Next business day
        })
        .eq('id', prospect.id);

      console.log(`✅ ${prospect.first_name} ${prospect.last_name} accepted CR`);
    } else {
      // CR was declined or withdrawn
      await supabase
        .from('campaign_prospects')
        .update({ status: 'declined' })
        .eq('id', prospect.id);
    }
  }
}

// Schedule follow-up for 1 day after acceptance (business hours)
function scheduleFollowUp(prospect: any): string {
  const now = new Date();
  let followUp = new Date(now);
  followUp.setDate(followUp.getDate() + 1);  // +1 day

  // Add variance (±2 days)
  const variance = getMessageVariance(prospect.campaign.follow_up_template?.length || 100);
  followUp.setDate(followUp.getDate() + variance.followUpVariance);

  // Ensure business day
  const country = prospect.country || 'US';
  while (!isWorkingDay(followUp, country)) {
    followUp.setDate(followUp.getDate() + 1);
  }

  // Set to business hours (9 AM - 5 PM)
  followUp.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);

  return followUp.toISOString();
}
```

### Reply Detection (LinkedIn)

**Location:** `/app/api/cron/poll-message-replies/route.ts`

```typescript
// Runs every 15 minutes
// Detects replies and stops follow-up sequence

export async function POST(request: NextRequest) {
  // 1. Get active prospects (CR sent or connected, not yet replied)
  const { data: activeProspects } = await supabase
    .from('campaign_prospects')
    .select('*, campaign:campaigns(*)')
    .in('status', ['connection_request_sent', 'connected', 'follow_up_sent'])
    .is('replied_at', null);

  for (const prospect of activeProspects) {
    const accountId = prospect.campaign.linkedin_account_id;

    // 2. Get conversation with this prospect
    const conversation = await getConversation(accountId, prospect.linkedin_provider_id);
    if (!conversation) continue;

    // 3. Check for new messages since last check
    const lastProcessedId = prospect.last_processed_message_id;
    const newMessages = conversation.messages.filter(m =>
      m.id !== lastProcessedId &&
      m.sender_id !== accountId  // From prospect, not us
    );

    if (newMessages.length === 0) continue;

    // 4. Mark as replied - STOP SEQUENCE
    await supabase
      .from('campaign_prospects')
      .update({
        status: 'replied',
        replied_at: new Date().toISOString(),
        last_processed_message_id: newMessages[newMessages.length - 1].id,
      })
      .eq('id', prospect.id);

    // 5. Log incoming message
    await supabase.from('linkedin_messages').insert({
      workspace_id: prospect.workspace_id,
      campaign_id: prospect.campaign_id,
      prospect_id: prospect.id,
      direction: 'incoming',
      message_type: 'reply',
      content: newMessages[0].content,
      received_at: new Date().toISOString(),
    });

    // 6. Create draft for Reply Agent (HITL)
    await supabase.from('reply_drafts').insert({
      workspace_id: prospect.workspace_id,
      prospect_id: prospect.id,
      original_message: newMessages[0].content,
      status: 'pending_generation',
    });

    console.log(`📬 New reply from ${prospect.first_name} ${prospect.last_name}`);
  }
}
```

### Multi-Turn Conversation Support

```typescript
// Added December 13, 2025
// Detects 2nd, 3rd, etc. messages in ongoing conversations

// Track last_processed_message_id to detect NEW messages only
const newMessages = conversation.messages.filter(m =>
  m.timestamp > prospect.last_processed_message_id_timestamp &&
  m.sender_id !== accountId
);

// Each new message triggers a reply draft
for (const message of newMessages) {
  await createReplyDraft(prospect, message);
}

// Update tracking
await supabase
  .from('campaign_prospects')
  .update({
    last_processed_message_id: newMessages[newMessages.length - 1].id,
  })
  .eq('id', prospect.id);
```

---

## Email Campaign System

### Queue Creation

**Location:** `/app/api/campaigns/email/send-emails-queued/route.ts`

```typescript
// POST /api/campaigns/email/send-emails-queued
// Creates email queue records with timezone-aware scheduling

export async function POST(request: NextRequest) {
  const { campaign_id, prospects, subject_template, body_template } = await request.json();

  // 1. Validate prospects have emails
  const validProspects = prospects.filter(p => p.email && isValidEmail(p.email));

  // 2. Calculate scheduling (13.5 min spacing = ~40/day)
  const queueRecords = validProspects.map((prospect, index) => {
    const scheduledFor = calculateEmailSchedule(index, prospect.timezone);

    return {
      workspace_id: prospect.workspace_id,
      campaign_id,
      prospect_id: prospect.id,
      recipient_email: prospect.email,
      recipient_name: `${prospect.first_name} ${prospect.last_name}`,
      recipient_timezone: prospect.timezone || 'America/Los_Angeles',
      subject: personalizeMessage(subject_template, prospect),
      body_html: personalizeMessage(body_template, prospect),
      scheduled_for: scheduledFor,
      status: 'pending',
    };
  });

  // 3. Bulk insert
  await supabase.from('email_queue').insert(queueRecords);

  return NextResponse.json({
    success: true,
    queued: queueRecords.length,
  });
}

// Calculate schedule: 8 AM - 5 PM recipient time, no weekends
function calculateEmailSchedule(index: number, timezone: string): string {
  const now = new Date();
  const minutesOffset = index * 13.5;  // 13.5 min spacing

  let scheduled = new Date(now.getTime() + minutesOffset * 60 * 1000);

  // Convert to recipient timezone
  const recipientTime = new Date(scheduled.toLocaleString('en-US', { timeZone: timezone }));
  const hour = recipientTime.getHours();

  // If outside business hours (8 AM - 5 PM), move to next business day 8 AM
  if (hour < 8) {
    recipientTime.setHours(8, 0, 0, 0);
  } else if (hour >= 17) {
    recipientTime.setDate(recipientTime.getDate() + 1);
    recipientTime.setHours(8, 0, 0, 0);
  }

  // Skip weekends
  while (recipientTime.getDay() === 0 || recipientTime.getDay() === 6) {
    recipientTime.setDate(recipientTime.getDate() + 1);
  }

  return recipientTime.toISOString();
}
```

### Email Queue Processing

**Location:** `/app/api/cron/process-email-queue/route.ts`

```typescript
// Runs every 13 minutes
// Sends 1 email per run = ~40 emails/day

export async function POST(request: NextRequest) {
  // 1. Find next due email
  const { data: email } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(1)
    .single();

  if (!email) {
    return NextResponse.json({ skipped: true, reason: 'no_emails_due' });
  }

  // 2. Send via Unipile or ReachInbox
  const result = await sendEmail({
    to: email.recipient_email,
    subject: email.subject,
    html: email.body_html,
    from: campaign.sender_email,
  });

  // 3. Update queue
  await supabase
    .from('email_queue')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider_message_id: result.message_id,
    })
    .eq('id', email.id);

  return NextResponse.json({ success: true, email_id: email.id });
}
```

### ReachInbox Integration

**Location:** `/app/api/campaigns/email/reachinbox/`

```typescript
// ReachInbox for cold email campaigns
// Provides: email warmup, deliverability tracking, bounce handling

// POST /api/campaigns/email/reachinbox
export async function createReachInboxCampaign(campaign: any) {
  const response = await fetch('https://api.reachinbox.io/v1/campaigns', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REACHINBOX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: campaign.name,
      from_email: campaign.sender_email,
      prospects: campaign.prospects.map(p => ({
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        company: p.company,
      })),
      sequence: campaign.email_sequence,
    }),
  });

  return response.json();
}
```

---

## Unipile Integration

### Configuration

```typescript
// Environment variables
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=<your_api_key>

// Base URL construction
const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
```

### API Wrapper

**Location:** `/lib/services/unipile-sender.ts`

```typescript
export class UnipileSender {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = `https://${process.env.UNIPILE_DSN}`;
    this.apiKey = process.env.UNIPILE_API_KEY!;
  }

  // Send connection request
  async sendConnectionRequest(
    recipientId: string,
    message: string,
    accountId: string
  ): Promise<{ success: boolean; message_id?: string; error?: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/users/invite`, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_id: accountId,
        provider_id: recipientId,
        message: message,
      }),
      signal: AbortSignal.timeout(30000),  // 30s timeout
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Send direct message
  async sendMessage(
    recipientId: string,
    message: string,
    accountId: string,
    chatId?: string
  ): Promise<{ success: boolean; message_id?: string }> {
    const endpoint = chatId
      ? `${this.baseUrl}/api/v1/chats/${chatId}/messages`
      : `${this.baseUrl}/api/v1/messages`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_id: accountId,
        recipient_id: recipientId,
        text: message,
      }),
      signal: AbortSignal.timeout(30000),
    });

    return response.json();
  }

  // Get pending invitations
  async getPendingInvitations(accountId: string): Promise<Invitation[]> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/users/invite/sent?account_id=${accountId}`,
      {
        headers: { 'X-API-KEY': this.apiKey },
      }
    );
    const data = await response.json();
    return data.items || [];
  }

  // Get connections
  async getConnections(accountId: string): Promise<Connection[]> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/users/relations?account_id=${accountId}`,
      {
        headers: { 'X-API-KEY': this.apiKey },
      }
    );
    const data = await response.json();
    return data.items || [];
  }

  // Get profile by vanity (CRITICAL: Use legacy endpoint, not profile?identifier=)
  async getProfile(vanity: string, accountId: string): Promise<Profile> {
    // ⚠️ CRITICAL BUG FIX (Nov 22, 2025):
    // /api/v1/users/profile?identifier= returns WRONG profiles for vanities with numbers
    // ALWAYS use legacy /api/v1/users/{vanity} endpoint instead

    const response = await fetch(
      `${this.baseUrl}/api/v1/users/${vanity}?account_id=${accountId}`,
      {
        headers: { 'X-API-KEY': this.apiKey },
      }
    );

    return response.json();
  }
}
```

### Critical Bug Fix (November 22, 2025)

```typescript
// ⚠️ CRITICAL: Profile lookup bug
//
// BROKEN: /api/v1/users/profile?identifier={vanity}
//   - Returns WRONG profiles for vanities with numbers
//   - Example: noah-ottmar-b59478295 returned Jamshaid Ali's profile
//
// CORRECT: /api/v1/users/{vanity}?account_id=...
//   - Legacy endpoint correctly resolves all vanities
//
// This bug caused:
//   - Legitimate prospects rejected with "invitation previously withdrawn"
//   - CRs never reaching LinkedIn

// Always use this pattern:
const profile = await unipile.getProfile(vanity, accountId);  // Uses legacy endpoint
```

---

## Configuration

### Environment Variables

```bash
# Netlify environment (production)
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=<your_api_key>
CRON_SECRET=<random_secret>

# Optional integrations
REACHINBOX_API_KEY=<reachinbox_key>
POSTMARK_SERVER_TOKEN=<postmark_token>
```

### Default Settings

```typescript
// Rate limits
const RATE_LIMITS = {
  crs_per_day: 20,
  crs_per_week: 100,
  dms_per_day: 50,
  emails_per_day: 40,
  min_spacing_minutes: 2,
  queue_spacing_minutes: 30,
};

// Business hours (Pacific Time)
const BUSINESS_HOURS = {
  start: 5,   // 5 AM PT
  end: 17,    // 5 PM PT
  timezone: 'America/Los_Angeles',
};

// Anti-detection
const ANTI_DETECTION = {
  skip_probability: 0.05,        // 5% random skip
  max_delay_seconds: 45,         // 0-45s random delay
  follow_up_variance_days: 2,    // ±2 days variance
};
```

---

## Troubleshooting

### Common Issues

#### Messages Not Sending

1. Check queue has pending messages:
```sql
SELECT status, COUNT(*) FROM send_queue GROUP BY status;
```

2. Check business hours and weekend:
```bash
TZ="America/Los_Angeles" date
```

3. Check Netlify function logs:
```bash
netlify logs:function process-send-queue --tail
```

4. Check rate limits:
```sql
SELECT COUNT(*) FROM send_queue
WHERE status = 'sent'
  AND sent_at > NOW() - INTERVAL '24 hours'
  AND campaign_id IN (SELECT id FROM campaigns WHERE linkedin_account_id = '<account_id>');
```

#### Connection Acceptance Not Detected

1. Check poll-accepted-connections is running:
```bash
netlify logs:function poll-accepted-connections --tail
```

2. Verify Unipile account is connected:
```sql
SELECT * FROM workspace_members WHERE linkedin_unipile_account_id IS NOT NULL;
```

3. Manual check via Unipile:
```bash
curl -H "X-API-KEY: $UNIPILE_API_KEY" \
  "https://api6.unipile.com:13670/api/v1/users/relations?account_id=<account_id>"
```

#### Follow-ups Not Sending

1. Check prospect status is 'connected':
```sql
SELECT * FROM campaign_prospects
WHERE status = 'connected'
  AND follow_up_scheduled_for < NOW()
  AND follow_up_sent_at IS NULL;
```

2. Check send-follow-ups function:
```bash
netlify logs:function send-follow-ups --tail
```

### Debugging Commands

```bash
# View all cron function logs
netlify logs:function process-send-queue --tail
netlify logs:function poll-accepted-connections --tail
netlify logs:function poll-message-replies --tail
netlify logs:function send-follow-ups --tail

# Check queue status
curl https://app.meet-sam.com/api/cron/process-send-queue \
  -H "x-cron-secret: $CRON_SECRET" \
  -X POST

# Check pending queue
curl "https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/send_queue?status=eq.pending&select=id,scheduled_for,status" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

### Monitoring Queries

```sql
-- Queue status by campaign
SELECT
  c.name as campaign_name,
  sq.status,
  COUNT(*) as count
FROM send_queue sq
JOIN campaigns c ON c.id = sq.campaign_id
GROUP BY c.name, sq.status
ORDER BY c.name, sq.status;

-- Today's sent messages
SELECT
  DATE(sent_at) as date,
  COUNT(*) as sent,
  COUNT(DISTINCT campaign_id) as campaigns
FROM send_queue
WHERE status = 'sent'
  AND sent_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE(sent_at);

-- Prospect status distribution
SELECT status, COUNT(*)
FROM campaign_prospects
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY status
ORDER BY COUNT(*) DESC;

-- Reply rate by campaign
SELECT
  c.name,
  COUNT(*) FILTER (WHERE cp.status = 'connection_request_sent') as crs_sent,
  COUNT(*) FILTER (WHERE cp.status = 'connected') as accepted,
  COUNT(*) FILTER (WHERE cp.status = 'replied') as replied,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cp.status = 'replied') /
    NULLIF(COUNT(*) FILTER (WHERE cp.status = 'connected'), 0), 1) as reply_rate
FROM campaign_prospects cp
JOIN campaigns c ON c.id = cp.campaign_id
GROUP BY c.name;

-- Failed messages for investigation
SELECT
  sq.id,
  sq.error_message,
  sq.scheduled_for,
  cp.first_name,
  cp.last_name,
  cp.linkedin_url
FROM send_queue sq
JOIN campaign_prospects cp ON cp.id = sq.prospect_id
WHERE sq.status = 'failed'
ORDER BY sq.created_at DESC
LIMIT 20;
```

---

## Changelog

### December 16, 2025
- Documentation created

### December 13, 2025
- Added multi-turn conversation support for reply polling
- Track `last_processed_message_id` for detecting NEW messages only

### December 11, 2025
- Implemented randomized follow-up intervals (±2 days) for anti-detection

### November 27, 2025
- Fixed follow-up scheduling bug - was scheduling immediately instead of after acceptance

### November 22, 2025
- **CRITICAL**: Fixed Unipile profile lookup bug
- `profile?identifier=` returns WRONG profiles for vanities with numbers
- All code now uses legacy `/users/{vanity}` endpoint
- Files fixed: send-connection-requests, process-follow-ups, poll-accepted-connections
- Updated Unipile API key via `netlify env:set`

### November 22, 2025 (Queue System)
- Implemented queue-based campaign execution
- Created `send_queue` table
- Netlify scheduled function processing 1 message/minute
- Rate limiting: 20 CRs/day, 2-min spacing
- Business hours, weekend, holiday blocking

---

**Documentation maintained by:** Claude Code
**Last verified:** December 16, 2025
**Production status:** Fully operational
