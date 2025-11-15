# Phase 1 Complete: Multi-Channel Campaign Orchestration Database

**Date:** November 15, 2025
**Status:** ✅ Complete
**Next:** Phase 2 - N8N Email Support

---

## What Was Built

### Database Schema
Created `campaign_prospect_execution_state` table to track execution state for multi-channel campaigns.

**Key Features:**
- Per-prospect execution tracking
- Multi-step campaign support
- Channel-specific state (LinkedIn, Email, WhatsApp)
- Trigger waiting (e.g., wait for LinkedIn connection acceptance)
- Scheduled execution (next_execution_at for N8N polling)

### Table Structure
```sql
campaign_prospect_execution_state (
  -- Identity
  id UUID PRIMARY KEY,
  campaign_id UUID → campaigns(id),
  prospect_id UUID → campaign_prospects(id),

  -- Step tracking
  current_step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending', -- pending, executing, waiting_trigger, completed, failed, paused
  completed_steps INTEGER[],
  failed_steps INTEGER[],
  skipped_steps INTEGER[],

  -- Channel states (JSONB)
  linkedin_state JSONB,  -- { connection_status, last_message_at, message_count }
  email_state JSONB,     -- { sent_count, opened, replied, last_sent_at, bounce_status }
  whatsapp_state JSONB,  -- { sent_count, delivered, read, replied, last_sent_at }

  -- Trigger waiting
  waiting_for_trigger TEXT,     -- 'connection_accepted', null
  trigger_check_count INTEGER,
  trigger_max_checks INTEGER DEFAULT 168,  -- 7 days hourly checks
  next_check_at TIMESTAMP,

  -- Orchestration
  n8n_execution_id TEXT,
  last_executed_at TIMESTAMP,
  next_execution_at TIMESTAMP,  -- When to execute next step

  -- Error tracking
  last_error TEXT,
  error_count INTEGER,

  UNIQUE(campaign_id, prospect_id)
)
```

### Helper Functions

**initialize_execution_state(campaign_id, prospect_id)**
- Initializes execution state for new prospect
- Sets current_step = 1, status = 'pending'
- Sets next_execution_at = NOW() (execute immediately)
- Called automatically when prospects are uploaded

**get_next_pending_executions(limit)**
- Returns prospects ready for next step execution
- Filters: status IN ('pending', 'waiting_trigger') AND next_execution_at <= NOW()
- Used by N8N scheduler to find work

### API Integration

**upload-prospects/route.ts**
- Modified to initialize execution state on prospect insert
- Each new prospect gets execution state record
- Ready for N8N orchestration

---

## How It Works

### 1. Campaign Creation Flow
```
User creates campaign
  → Uploads prospects
    → For each prospect:
      → Insert into campaign_prospects
      → Call initialize_execution_state()
        → Creates execution state record (step=1, status=pending, next_execution_at=NOW)
```

### 2. N8N Orchestration (Future - Phase 2+)
```
N8N Scheduler (runs every minute)
  → Call get_next_pending_executions(10)
    → Returns prospects where next_execution_at <= NOW
  → For each prospect:
    → Read campaign.flow_settings.steps[current_step]
    → Execute step action (send_email, send_linkedin_cr, etc.)
    → Update execution state:
      - Add to completed_steps
      - Increment current_step
      - Set next_execution_at based on delay
      - Update channel_state
```

### 3. Multi-Step Example
```json
Campaign with 3 steps:
Step 1: LinkedIn CR → wait for acceptance → next_execution = +72 hours
Step 2: Email intro → immediate → next_execution = +48 hours
Step 3: LinkedIn message → immediate → next_execution = +120 hours

Execution State Progression:
Time 0:   { current_step: 1, status: 'pending', next_execution_at: 'NOW' }
Time 0:   Execute Step 1 (LinkedIn CR)
          { current_step: 1, status: 'waiting_trigger', waiting_for: 'connection_accepted', next_check_at: '+1 hour' }
Time 12h: Connection accepted!
          { current_step: 2, status: 'pending', linkedin_state: { connection_status: 'accepted' }, next_execution_at: 'NOW' }
Time 12h: Execute Step 2 (Email)
          { current_step: 3, status: 'pending', email_state: { sent_count: 1 }, next_execution_at: '+48 hours' }
Time 60h: Execute Step 3 (LinkedIn message)
          { current_step: 4, status: 'completed', linkedin_state: { message_count: 1 } }
```

---

## Benefits

1. **Multi-Channel Support** - Single table tracks LinkedIn, Email, WhatsApp state
2. **Flexible Sequencing** - Steps defined in campaign.flow_settings, not hardcoded
3. **Smart Waiting** - Can wait for triggers (connection acceptance) with retry logic
4. **Cross-Channel Intelligence** - One prospect, multiple channels, shared state
5. **Scalable** - Database-driven, N8N just executes
6. **Debuggable** - Full state history in database

---

## Migration Applied

**File:** `supabase/migrations/20251115_create_campaign_execution_state.sql`

**Applied to Production:** ✅ Yes
**Tables Created:** 1
**Indexes Created:** 4
**Functions Created:** 3
**RLS Policies:** 2

---

## Testing

### Verify Table
```sql
-- Check table exists
\d campaign_prospect_execution_state;

-- Check helper functions
SELECT proname FROM pg_proc WHERE proname LIKE '%execution%';
```

### Test Initialization
```sql
-- Test prospect upload creates execution state
-- 1. Create test campaign
-- 2. Upload prospect via API
-- 3. Verify execution state created:
SELECT * FROM campaign_prospect_execution_state WHERE campaign_id = 'test_campaign_id';

-- Expected:
-- current_step = 1
-- status = 'pending'
-- next_execution_at = NOW()
```

---

## Next Steps: Phase 2

### Email Support in N8N Workflow

**Tasks:**
1. Download current N8N workflow
2. Add "Email Channel Router" branch to Campaign Handler
3. Create email action nodes:
   - "Send Email via Unipile"
   - "Check Email Reply"
   - "Update Email State"
4. Read execution state instead of hardcoded flow
5. Update execution state after each step
6. Test email campaign end-to-end

**Files to Modify:**
- N8N workflow: `SAM Master Campaign Orchestrator` (aVG6LC4ZFRMN7Bw6)
- Campaign Handler node (read execution state)
- Add Email branch nodes

**API Integration:**
- Unipile Email API: `POST /api/v1/messages/send`
- Update execution state: `UPDATE campaign_prospect_execution_state SET email_state = ...`

---

## Current State

**✅ Database Ready** - Execution state table deployed to production
**✅ API Integration** - Prospects auto-initialize execution state
**⏳ N8N Workflow** - Still LinkedIn-only, needs email support (Phase 2)
**⏳ Email Campaigns** - Will fail until Phase 2 complete

**Email campaigns currently fail with:**
"V1 Campaign Orchestration failed" - because N8N doesn't support email yet.

**Solution:** Complete Phase 2 to add email support to N8N workflow.

---

**Last Updated:** November 15, 2025
**Author:** SAM AI Team
**Status:** Phase 1 Complete, Phase 2 Ready to Start
