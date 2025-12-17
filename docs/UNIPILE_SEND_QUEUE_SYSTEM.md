# Unipile & Send Queue System - Technical Documentation

**Version:** 1.0
**Last Updated:** December 17, 2025
**Status:** Production

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Schema](#2-database-schema)
3. [Unipile Integration](#3-unipile-integration)
4. [Campaign Execution Flow](#4-campaign-execution-flow)
5. [Anti-Detection & Rate Limiting](#5-anti-detection--rate-limiting)
6. [API Endpoints](#6-api-endpoints)
7. [Cron Jobs & Scheduled Functions](#7-cron-jobs--scheduled-functions)
8. [Monitoring & Debugging](#8-monitoring--debugging)
9. [Known Issues & Fixes](#9-known-issues--fixes)
10. [Configuration](#10-configuration)

---

## 1. System Overview

The Unipile Send Queue System is a LinkedIn-safe campaign execution architecture that:

- **Queues all outbound messages** with 20-minute minimum spacing
- **Enforces rate limits** (25 CRs/day, 5 CRs/hour per account)
- **Implements anti-detection** (randomized delays, message variance)
- **Processes queues via Netlify scheduled functions** (every minute)
- **Manages prospect lifecycle** from approval → queue → sent → follow-up

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CAMPAIGN EXECUTION FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────────┐    ┌─────────────────────────┐   │
│  │  CSV Upload  │───►│ prospect_approval │───►│ prospect_approval_      │   │
│  │              │    │ _data (pending)   │    │ decisions (approved)    │   │
│  └──────────────┘    └──────────────────┘    └───────────┬─────────────┘   │
│                                                          │                  │
│                                              ┌───────────▼─────────────┐   │
│                                              │   BULK APPROVE API      │   │
│                                              │   Auto-Transfer +       │   │
│                                              │   Auto-Queue            │   │
│                                              └───────────┬─────────────┘   │
│                                                          │                  │
│  ┌──────────────────────────────────────────────────────▼──────────────┐   │
│  │                       campaign_prospects                             │   │
│  │  status: approved → cr_sent → connected → fu1_sent → replied        │   │
│  └──────────────────────────────────────────────────────┬──────────────┘   │
│                                                          │                  │
│  ┌──────────────────────────────────────────────────────▼──────────────┐   │
│  │                          send_queue                                  │   │
│  │  status: pending → sent (or failed)                                  │   │
│  │  scheduled_for: 20-min spacing per prospect                          │   │
│  └──────────────────────────────────────────────────────┬──────────────┘   │
│                                                          │                  │
│  ┌──────────────────────────────────────────────────────▼──────────────┐   │
│  │                    CRON: process-send-queue                          │   │
│  │  Runs every minute, sends 1 message, respects rate limits           │   │
│  └──────────────────────────────────────────────────────┬──────────────┘   │
│                                                          │                  │
│  ┌──────────────────────────────────────────────────────▼──────────────┐   │
│  │                        Unipile API                                   │   │
│  │  POST /api/v1/accounts/{id}/messaging/send                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema

### 2.1 campaigns (Campaign Definitions)

```sql
CREATE TABLE campaigns (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT DEFAULT 'linkedin_only',  -- linkedin_only, email_only, multi_channel
  status TEXT DEFAULT 'draft',                 -- draft, active, paused, completed

  -- Channel configuration
  channel_preferences JSONB DEFAULT '{"email": false, "linkedin": true}',
  linkedin_config JSONB,
  email_config JSONB,

  -- LinkedIn account binding (CRITICAL - FK enforced Dec 2025)
  linkedin_account_id UUID REFERENCES user_unipile_accounts(id) ON DELETE SET NULL,

  -- Message templates (JSONB array)
  message_templates JSONB,
  /*
    Example structure:
    {
      "connection_request": "Hi {{first_name}}, I noticed...",
      "follow_up_1": "Hi {{first_name}}, just wanted to follow up...",
      "follow_up_2": "Hi {{first_name}}, I hope you're doing well...",
      "follow_up_3": "Hi {{first_name}}, one last note..."
    }
  */
  connection_message TEXT,
  alternative_message TEXT,
  follow_up_messages JSONB,

  -- Scheduling
  timezone TEXT,                    -- e.g., 'America/New_York', 'Europe/Berlin'
  working_hours_start INT,          -- e.g., 9 (9 AM)
  working_hours_end INT,            -- e.g., 17 (5 PM)
  skip_weekends BOOLEAN DEFAULT true,
  skip_holidays BOOLEAN DEFAULT true,
  country_code TEXT,                -- e.g., 'US', 'DE' for holiday calendar
  schedule_settings JSONB,
  send_schedule JSONB,
  next_execution_time TIMESTAMP,
  auto_execute BOOLEAN DEFAULT false,

  -- N8N integration (legacy)
  n8n_execution_id TEXT,
  n8n_workflow_id TEXT,
  n8n_webhook_url TEXT,

  -- A/B testing
  ab_test_variant TEXT,             -- 'A', 'B', or NULL

  -- Campaign flow
  funnel_type TEXT,
  funnel_id TEXT,
  funnel_configuration JSONB,
  flow_settings JSONB,
  current_step INT,

  -- ICP targeting
  target_criteria JSONB,
  target_icp JSONB,

  -- Templates
  template_id UUID,
  core_template_id UUID,
  dynamic_definition_id UUID,

  -- Draft storage
  draft_data JSONB,

  -- Metadata
  metadata JSONB,
  message_sequence JSONB,
  execution_preferences JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  launched_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_linkedin_account ON campaigns(linkedin_account_id);
```

### 2.2 campaign_prospects (Prospects in Active Campaigns)

```sql
CREATE TABLE campaign_prospects (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Prospect identity
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,

  -- LinkedIn data
  linkedin_url TEXT,
  linkedin_user_id TEXT,
  linkedin_url_hash TEXT,           -- For deduplication
  connection_degree TEXT,           -- '1st', '2nd', '3rd'

  -- Company info
  company_name TEXT,
  company_name_normalized TEXT,     -- Cleaned/normalized
  company_website TEXT,
  title TEXT,
  title_normalized TEXT,

  -- Location
  location TEXT,
  location_normalized TEXT,
  industry TEXT,

  -- Status tracking
  status TEXT DEFAULT 'pending',
  /*
    Status values:
    - pending: Not yet processed
    - approved: Approved for outreach
    - queued_in_n8n: Sent to N8N (legacy)
    - contacted: CR sent
    - connection_request_sent: CR sent (alias)
    - connected: CR accepted
    - fu1_sent, fu2_sent, fu3_sent: Follow-ups sent
    - replied: Prospect responded
    - not_interested: Declined
    - failed: Error occurred
    - error: Processing error
  */

  -- A/B testing
  ab_variant VARCHAR(1),            -- 'A' or 'B'

  -- Unipile ownership (LinkedIn TOS compliance)
  added_by_unipile_account TEXT,    -- Which account found this prospect
  unipile_account_id TEXT,

  -- Follow-up tracking
  follow_up_sequence_index INT DEFAULT 0,
  follow_up_due_at TIMESTAMP,
  last_follow_up_at TIMESTAMP,

  -- Engagement tracking
  contacted_at TIMESTAMP,
  connection_accepted_at TIMESTAMP,
  responded_at TIMESTAMP,
  scheduled_send_at TIMESTAMP,

  -- Scoring
  engagement_score INT,
  priority_level TEXT,
  scoring_metadata JSONB,

  -- Validation
  validation_status TEXT,
  validation_errors JSONB,
  validation_warnings JSONB,
  validated_at TIMESTAMP,

  -- Previous contact detection
  has_previous_contact BOOLEAN DEFAULT false,
  previous_contact_status TEXT,

  -- Meeting tracking
  meeting_id UUID,
  meeting_scheduled_at TIMESTAMP,
  meeting_status TEXT,

  -- Message processing
  last_processed_message_id TEXT,

  -- Master prospect linkage
  master_prospect_id UUID,

  -- Personalization & notes
  personalization_data JSONB DEFAULT '{}',
  notes TEXT,

  -- Legacy
  n8n_execution_id TEXT,
  added_by UUID,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_campaign_prospects_campaign ON campaign_prospects(campaign_id);
CREATE INDEX idx_campaign_prospects_status ON campaign_prospects(status);
CREATE INDEX idx_campaign_prospects_workspace ON campaign_prospects(workspace_id);
CREATE INDEX idx_campaign_prospects_linkedin_url ON campaign_prospects(linkedin_url_hash);
CREATE INDEX idx_campaign_prospects_follow_up ON campaign_prospects(follow_up_due_at)
  WHERE follow_up_due_at IS NOT NULL;
```

### 2.3 send_queue (LinkedIn Message Queue)

```sql
CREATE TABLE send_queue (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES campaign_prospects(id) ON DELETE CASCADE,

  -- LinkedIn target
  linkedin_user_id TEXT NOT NULL,

  -- Message content
  message TEXT NOT NULL,
  message_type VARCHAR(50),         -- 'connection_request', 'follow_up', 'inmail'
  variant TEXT,                     -- A/B test variant

  -- Voice message support
  voice_message_url TEXT,
  requires_connection BOOLEAN DEFAULT true,

  -- Scheduling
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Values: pending, sent, failed, skipped

  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(campaign_id, prospect_id)
);

-- Indexes
CREATE INDEX idx_send_queue_pending ON send_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_send_queue_campaign ON send_queue(campaign_id, status);
```

### 2.4 user_unipile_accounts (LinkedIn Accounts)

```sql
CREATE TABLE user_unipile_accounts (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  workspace_id UUID REFERENCES workspaces(id),

  -- Unipile identifiers
  unipile_account_id TEXT NOT NULL UNIQUE,
  platform TEXT DEFAULT 'linkedin', -- linkedin, email

  -- Account info
  account_name TEXT,
  account_email TEXT,
  linkedin_public_identifier TEXT,
  linkedin_profile_url TEXT,
  linkedin_account_type TEXT,       -- 'basic', 'premium', 'sales_navigator'

  -- Features & metadata
  account_features JSONB,
  account_metadata JSONB,

  -- Connection status
  connection_status TEXT DEFAULT 'active',
  -- Values: active, disconnected, expired, error

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_unipile_accounts_workspace ON user_unipile_accounts(workspace_id);
CREATE INDEX idx_user_unipile_accounts_user ON user_unipile_accounts(user_id);
CREATE INDEX idx_user_unipile_accounts_unipile ON user_unipile_accounts(unipile_account_id);
```

### 2.5 prospect_approval_sessions (Approval Batches)

```sql
CREATE TABLE prospect_approval_sessions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID REFERENCES auth.users(id),

  -- Session info
  batch_number INT,
  status TEXT DEFAULT 'pending',    -- pending, in_progress, completed

  -- Campaign linking
  campaign_id UUID REFERENCES campaigns(id),
  campaign_name TEXT,
  campaign_tag TEXT,

  -- Counts
  total_prospects INT DEFAULT 0,
  approved_count INT DEFAULT 0,
  rejected_count INT DEFAULT 0,
  pending_count INT DEFAULT 0,

  -- ICP & source
  icp_criteria JSONB,
  prospect_source TEXT,             -- 'csv', 'linkedin_search', 'sales_navigator'

  -- Learning
  learning_insights JSONB,

  -- Metadata
  metadata JSONB,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### 2.6 prospect_approval_data (Prospects Pending Approval)

```sql
CREATE TABLE prospect_approval_data (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES prospect_approval_sessions(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id),

  -- Prospect info
  prospect_id TEXT,                 -- External ID from source
  name TEXT,
  title TEXT,
  company TEXT,
  location TEXT,
  contact TEXT,                     -- Email or phone if available
  profile_image TEXT,

  -- LinkedIn data
  connection_degree TEXT,
  recent_activity TEXT,

  -- Enrichment
  enrichment_score INT,
  enriched_at TIMESTAMP,
  source TEXT,

  -- Approval status
  approval_status TEXT DEFAULT 'pending',  -- pending, approved, rejected

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.7 email_queue (Email Message Queue)

```sql
CREATE TABLE email_queue (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  account_id VARCHAR(255) NOT NULL, -- Unipile email account ID

  -- Recipient info
  prospect_id UUID REFERENCES campaign_prospects(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  recipient_location VARCHAR(255),
  recipient_timezone VARCHAR(50),   -- IANA timezone

  -- Email content
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_plain TEXT,
  tracking_label VARCHAR(255),

  -- Scheduling
  scheduled_for TIMESTAMP NOT NULL, -- UTC
  sent_at TIMESTAMP,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  unipile_message_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(campaign_id, prospect_id, recipient_email)
);
```

### 2.8 Table Relationships (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE RELATIONSHIPS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  workspaces                                                                 │
│      │                                                                      │
│      ├──► user_unipile_accounts.workspace_id                               │
│      ├──► campaigns.workspace_id                                           │
│      ├──► campaign_prospects.workspace_id                                  │
│      ├──► prospect_approval_sessions.workspace_id                          │
│      ├──► prospect_approval_data.workspace_id                              │
│      └──► email_queue.workspace_id                                         │
│                                                                             │
│  user_unipile_accounts                                                      │
│      │                                                                      │
│      └──► campaigns.linkedin_account_id (FK enforced Dec 2025)             │
│                                                                             │
│  campaigns                                                                  │
│      │                                                                      │
│      ├──► campaign_prospects.campaign_id                                   │
│      ├──► send_queue.campaign_id                                           │
│      ├──► email_queue.campaign_id                                          │
│      └──► prospect_approval_sessions.campaign_id                           │
│                                                                             │
│  campaign_prospects                                                         │
│      │                                                                      │
│      ├──► send_queue.prospect_id                                           │
│      └──► email_queue.prospect_id                                          │
│                                                                             │
│  prospect_approval_sessions                                                 │
│      │                                                                      │
│      └──► prospect_approval_data.session_id                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.9 Status Value Reference

| Table | Column | Valid Values |
|-------|--------|--------------|
| campaigns | status | `draft`, `active`, `paused`, `completed` |
| campaign_prospects | status | `pending`, `approved`, `queued_in_n8n`, `contacted`, `connection_request_sent`, `connected`, `fu1_sent`, `fu2_sent`, `fu3_sent`, `replied`, `not_interested`, `failed`, `error` |
| send_queue | status | `pending`, `sent`, `failed`, `skipped` |
| email_queue | status | `pending`, `sent`, `failed`, `skipped` |
| user_unipile_accounts | connection_status | `active`, `disconnected`, `expired`, `error` |
| prospect_approval_sessions | status | `pending`, `in_progress`, `completed` |
| prospect_approval_data | approval_status | `pending`, `approved`, `rejected` |

---

## 3. Unipile Integration

### 3.1 Configuration

```bash
# Environment variables (set via netlify env:set)
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=
```

### 3.2 API Endpoints Used

| Operation | Endpoint | Method |
|-----------|----------|--------|
| Profile lookup | `/api/v1/users/{vanity}?account_id={id}` | GET |
| Send CR/Message | `/api/v1/accounts/{id}/messaging/send` | POST |
| List accounts | `/api/v1/accounts` | GET |
| Check connection | `/api/v1/users/{vanity}?account_id={id}` | GET |

### 3.3 Profile Lookup (Critical Fix - Nov 22, 2025)

**BROKEN Endpoint (DO NOT USE):**
```
GET /api/v1/users/profile?identifier={vanity}
```
Returns WRONG profiles for vanities with numbers (e.g., `noah-ottmar-b59478295`).

**CORRECT Endpoint:**
```
GET /api/v1/users/{vanity}?account_id={accountId}
```
Legacy endpoint that correctly resolves all vanity URLs.

### 3.4 Sending Messages

```typescript
// Send connection request
const response = await fetch(
  `https://${UNIPILE_DSN}/api/v1/accounts/${accountId}/messaging/send`,
  {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipient_id: providerId, // From profile lookup
      message: 'Hi Noah, I noticed...',
      platform: 'linkedin'
    })
  }
);
```

---

## 4. Campaign Execution Flow

### 4.1 Step 1: Campaign Creation

**Endpoint:** `POST /api/campaigns`
**File:** `app/api/campaigns/route.ts`

```typescript
// Validation (Dec 16 fix - fail fast)
if (!linkedinAccount) {
  return NextResponse.json({
    success: false,
    error: 'LinkedIn account not configured',
    details: 'Connect a LinkedIn account in Settings → Integrations'
  }, { status: 400 });
}
```

### 4.2 Step 2: Prospect Approval (HITL)

**Upload:** `POST /api/prospect-approval/upload-prospects`
**Approve:** `POST /api/prospect-approval/bulk-approve`

Flow:
```
CSV Upload → prospect_approval_data (pending_review)
    ↓
User Review → prospect_approval_decisions (approved/rejected)
    ↓ BULK APPROVE (auto-transfer)
campaign_prospects (approved status)
    ↓ AUTO-QUEUE (if campaign active)
send_queue (pending, 20-min spacing)
```

### 4.3 Step 3: Queue Creation

**File:** `app/api/prospect-approval/bulk-approve/route.ts`

```typescript
const gapMinutes = MESSAGE_HARD_LIMITS.MIN_CR_GAP_MINUTES; // 20 min

const queueRecords = prospectsToQueue.map((p, idx) => ({
  campaign_id: sessionData.campaign_id,
  prospect_id: p.id,
  linkedin_user_id: p.linkedin_url,
  message: personalizeMessage(connectionMessage, p),
  scheduled_for: new Date(Date.now() + idx * gapMinutes * 60 * 1000),
  status: 'pending',
  message_type: 'connection_request'
}));

await supabase.from('send_queue').insert(queueRecords);
```

### 4.4 Step 4: Queue Processing (Cron)

**Endpoint:** `POST /api/cron/process-send-queue`
**Schedule:** Every minute (Netlify scheduled function)

Process:
1. Find due messages (`scheduled_for <= NOW()`)
2. Check rate limits (daily, hourly, spacing)
3. Skip weekends/holidays
4. Send via Unipile API
5. Update queue status → 'sent'
6. Update prospect status → 'cr_sent'
7. Schedule follow-up (if applicable)

### 4.5 Step 5: Follow-up Processing

**Endpoint:** `POST /api/campaigns/direct/process-follow-ups`
**Schedule:** Every hour

Only processes prospects with:
- `status = 'connected'` (CR was accepted)
- `follow_up_due_at <= NOW()`

---

## 5. Anti-Detection & Rate Limiting

### 5.1 Rate Limits (MESSAGE_HARD_LIMITS)

**File:** `lib/anti-detection/message-variance.ts`

```typescript
export const MESSAGE_HARD_LIMITS = {
  // Daily limits per account
  MAX_CONNECTION_REQUESTS_PER_DAY: 25,
  MAX_MESSAGES_PER_DAY: 50,

  // Weekly limits
  MAX_CONNECTION_REQUESTS_PER_WEEK: 100,
  MAX_MESSAGES_PER_WEEK: 200,

  // Monthly limits
  MAX_OPEN_INMAILS_PER_MONTH: 100,

  // Hourly burst protection
  MAX_CONNECTION_REQUESTS_PER_HOUR: 5,
  MAX_MESSAGES_PER_HOUR: 10,

  // Minimum spacing
  MIN_CR_GAP_MINUTES: 20,
  MIN_MESSAGE_GAP_MINUTES: 5,

  // Error handling
  MAX_ERRORS_BEFORE_PAUSE: 3,
  PAUSE_DURATION_HOURS: 24,
};
```

### 5.2 Rate Limit Enforcement

**File:** `app/api/cron/process-send-queue/route.ts`

```typescript
// Daily limit check
const crsSentToday = sentToday.filter(s =>
  s.message_type === 'connection_request'
).length;

if (crsSentToday >= MESSAGE_HARD_LIMITS.MAX_CONNECTION_REQUESTS_PER_DAY) {
  console.log(`⏸️ Account hit daily CR cap (${crsSentToday}/25)`);
  continue; // Skip this account
}

// Hourly burst check
if (crsSentThisHour >= MESSAGE_HARD_LIMITS.MAX_CONNECTION_REQUESTS_PER_HOUR) {
  console.log(`⏸️ Account hit hourly CR cap (${crsSentThisHour}/5)`);
  continue;
}

// Spacing check (20-min minimum)
const minSpacing = MESSAGE_HARD_LIMITS.MIN_CR_GAP_MINUTES * 60 * 1000;
const lastSent = await getLastSentTime(accountId);
if (Date.now() - lastSent < minSpacing) {
  continue; // Too soon
}
```

### 5.3 Human-Like Variance

| Aspect | Distribution |
|--------|-------------|
| Message length | 15% brief, 30% short, 35% medium, 15% detailed, 5% comprehensive |
| Message tone | 30% friendly, 25% professional, 20% casual, 15% direct, 10% warm |
| Follow-up interval | Base 5-7 days ± 2 days variance |
| Pre-send delay | 30-90 seconds |
| A/B variant | ~55/45 with time-of-day bias |

### 5.4 Business Hours & Holidays

```typescript
// Skip weekends
if (dayOfWeek === 0 || dayOfWeek === 6) {
  // Reschedule to Monday, same time
  scheduledFor = getNextBusinessDay(scheduledFor);
}

// US Holidays (2025-2026)
const holidays = [
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
  '2026-01-01', // New Year
  // ... 11+ holidays
];
```

---

## 6. API Endpoints

### 6.1 Campaign Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/campaigns` | GET | List campaigns with metrics |
| `/api/campaigns` | POST | Create campaign (validates LinkedIn account) |
| `/api/campaigns/[id]` | PATCH | Update campaign |

### 6.2 Prospect Approval

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/prospect-approval/upload-prospects` | POST | Upload CSV |
| `/api/prospect-approval/bulk-approve` | POST | Approve + auto-transfer + auto-queue |
| `/api/prospect-approval/decisions` | POST | Individual decision |

### 6.3 Queue Processing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cron/process-send-queue` | POST | Process 1 message (cron) |
| `/api/campaigns/direct/process-follow-ups` | POST | Process follow-ups |
| `/api/cron/poll-accepted-connections` | POST | Check CR acceptance |

---

## 7. Cron Jobs & Scheduled Functions

### 7.1 Netlify Configuration

**File:** `netlify.toml`

```toml
[functions."process-send-queue"]
  schedule = "* * * * *"  # Every minute

[functions."send-follow-ups"]
  schedule = "0 * * * *"  # Every hour

[functions."poll-accepted-connections"]
  schedule = "*/15 * * * *"  # Every 15 minutes
```

### 7.2 Function Files

| Function | File | Purpose |
|----------|------|---------|
| process-send-queue | `netlify/functions/process-send-queue.ts` | Send queued messages |
| send-follow-ups | `netlify/functions/send-follow-ups.ts` | Process follow-ups |
| poll-accepted-connections | `netlify/functions/poll-accepted-connections.ts` | Check CR status |

### 7.3 Anti-Detection in Cron

```typescript
// netlify/functions/process-send-queue.ts

// 5% chance to skip entirely (anti-pattern)
if (Math.random() < 0.05) {
  return { statusCode: 200, body: 'Skipped (anti-detection)' };
}

// Random delay 0-45 seconds
const delay = Math.floor(Math.random() * 45000);
await new Promise(r => setTimeout(r, delay));
```

---

## 8. Monitoring & Debugging

### 8.1 Queue Status Query

```sql
SELECT
  status,
  COUNT(*) as count,
  MIN(scheduled_for) as earliest,
  MAX(scheduled_for) as latest
FROM send_queue
GROUP BY status;
```

### 8.2 Rate Limit Check

```sql
SELECT
  c.linkedin_account_id,
  COUNT(CASE WHEN sq.sent_at >= NOW() - INTERVAL '1 day' THEN 1 END) as sent_today,
  COUNT(CASE WHEN sq.sent_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as sent_this_hour
FROM send_queue sq
JOIN campaigns c ON sq.campaign_id = c.id
WHERE sq.status = 'sent'
GROUP BY c.linkedin_account_id;
```

### 8.3 Failed Messages

```sql
SELECT
  sq.id,
  cp.first_name,
  cp.linkedin_url,
  sq.error_message,
  sq.created_at
FROM send_queue sq
JOIN campaign_prospects cp ON sq.prospect_id = cp.id
WHERE sq.status = 'failed'
ORDER BY sq.created_at DESC
LIMIT 20;
```

### 8.4 Netlify Logs

```bash
# Real-time monitoring
netlify logs:function process-send-queue --tail

# Last 100 logs
netlify logs:function process-send-queue --last 100
```

---

## 9. Known Issues & Fixes

### 9.1 Profile Lookup Bug (Nov 22, 2025)

**Issue:** `/api/v1/users/profile?identifier={vanity}` returns wrong profiles for vanities with numbers.

**Fix:** Use legacy endpoint `/api/v1/users/{vanity}?account_id={id}`.

**Files Fixed:**
- `app/api/cron/process-send-queue/route.ts`
- `app/api/campaigns/direct/process-follow-ups/route.ts`
- `app/api/cron/poll-accepted-connections/route.ts`

### 9.2 Campaign Creation Validation (Dec 16, 2025)

**Issue:** Campaigns created without `linkedin_account_id` silently fail.

**Fix:** Fail fast with clear error message.

**File:** `app/api/campaigns/route.ts`

### 9.3 Auto-Transfer & Auto-Queue (Dec 16, 2025)

**Issue:** Approved prospects not automatically queued.

**Fix:** Bulk approve now auto-transfers to `campaign_prospects` and auto-queues to `send_queue`.

**File:** `app/api/prospect-approval/bulk-approve/route.ts`

---

## 10. Configuration

### 10.1 Environment Variables

```bash
# Unipile
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=

# Cron authentication
CRON_SECRET={secret}

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_SERVICE_ROLE_KEY={key}
```

### 10.2 Setting Environment Variables

```bash
# View all
netlify env:list

# Set variable
netlify env:set VARIABLE_NAME "value"

# Deploy after changes
netlify deploy --prod
```

### 10.3 Rate Limit Customization

Edit `lib/anti-detection/message-variance.ts`:

```typescript
export const MESSAGE_HARD_LIMITS = {
  MAX_CONNECTION_REQUESTS_PER_DAY: 25,  // Adjust if needed
  MIN_CR_GAP_MINUTES: 20,               // Minimum spacing
  // ...
};
```

---

## Summary

The Unipile Send Queue System provides:

- **Queue-based architecture:** 1 message per minute execution
- **Rate limiting:** 25 CRs/day, 5 CRs/hour, 20-min spacing
- **Anti-detection:** Random delays, message variance, skip probability
- **Multi-tenant isolation:** Workspace-based RLS policies
- **HITL approval:** Manual review before any campaign sends
- **Automated workflow:** Approve → Transfer → Queue → Send → Follow-up

All components are production-tested and deployed as of December 17, 2025.
