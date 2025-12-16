# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🚨🚨🚨 CRITICAL: CAMPAIGN EXECUTION ARCHITECTURE 🚨🚨🚨

**READ THIS FIRST - NOVEMBER 22, 2025**

### ✅ WHAT WE USE FOR CAMPAIGNS:
- **Connection Requests**: DIRECT Unipile REST API (`/api/campaigns/direct/send-connection-requests`)
- **Follow-up Messages**: DIRECT Unipile REST API
- **ALL LinkedIn Operations**: DIRECT Unipile REST API

### ❌ WHAT WE DO NOT USE:
- ❌ **N8N** - NOT used for campaign execution
- ❌ **Inngest** - NOT used for campaign execution
- ❌ **Workflows** - NOT used for campaign execution

**The system calls Unipile API directly. Period. No orchestration layers.**

**Unipile Configuration:**
- DSN: `api6.unipile.com:13670`
- API Key: `39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=` (set via `netlify env:set` - **NOVEMBER 22, 2025 FINAL FIX**)
- Account ID (Irish): `ymtTx4xVQ6OVUFk83ctwtA`

**⚠️ CRITICAL - November 22, 2025 (LATEST FIX):** Previous API key `POcBmCSV.b/t0gstHvY5alDsy/BmKQmUBt4FmNXRF7fdOYqywJSM=` was returning 401 "Missing credentials". Updated to correct key `39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=` via `netlify env:set UNIPILE_API_KEY "39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE="` and deployed to production. **✅ VERIFIED WORKING - Cron job now successfully processing queue.**

---

## 🎯 NEXT AGENT: START HERE (November 15, 2025)

### 📋 12-WEEK FEATURE ROLLOUT PLAN

**Full Plan:** See `SAM_FEATURE_ROLLOUT_PLAN.md` for complete details

**Target Completion:** February 2026 (12 weeks)
**Total Features:** 39 items across 5 phases

---

### 🚨 IMMEDIATE (This Week - P0 Critical)

**Before any new development:**

- [ ] **Upload updated N8N workflow** (1h)
  - File: `/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator - UPDATED.json`
  - Import to: https://workflows.innovareai.com
  - Activate workflow after upload

- [ ] **Fix N8N Docker environment variables** (1h)
  - Add `UNIPILE_DSN=api6.unipile.com:13670` to docker-compose.yml
  - Add `UNIPILE_API_KEY=...` to docker-compose.yml
  - Restart N8N container

- [ ] **Michelle reconnect LinkedIn to Unipile** (30m)
  - Settings → Integrations → Disconnect → Reconnect
  - Verify `connection_status = 'connected'`

- [ ] **Resume paused campaigns** (30m)
  - Michelle's 5 campaigns currently paused
  - Set status to 'active'

- [ ] **Test Edit Campaign modal** (1h)
  - Verify message_templates data loads correctly
  - Test with real campaign data from production
  - Confirm all follow-up messages display

- [ ] **Test View Prospects button** (30m)
  - Verify prospects list displays correctly
  - Check status and contacted_at fields

- [ ] **Test Pause/Resume button** (30m)
  - Toggle campaign status
  - Verify badge updates correctly

- [ ] **Remove redundant cron job** (1h)
  - Delete `/api/cron/check-accepted-connections`

---

### 📅 PHASE 1: Fix Existing Features (Week 1-2)

**Phase 1A: Campaign Hub Buttons (Week 1 - 20h)**

- [ ] Fix "View Messages" button (4h)
  - File: `components/CampaignHub.tsx` (lines 476-580)
  - Modal shows CR, follow-ups, goodbye messages

- [ ] Fix "View Prospects" button (4h)
  - Display all prospects with status, contacted_at

- [ ] Fix "Edit Campaign" button (6h)
  - Editable campaign name and messages
  - Save changes to database

- [ ] Fix "Pause/Resume" button (4h)
  - Toggle campaign status
  - Update badge display

- [ ] Test all buttons end-to-end (2h)

**Phase 1B: LinkedIn Commenting Agent (Week 2 - 7h)**

- [ ] Debug campaign creation error (4h)
  - File: `/app/api/linkedin-commenting/monitors/route.ts`
  - Get browser console logs OR Netlify function logs
  - Likely: RLS policy issue or missing workspace membership
  - Fix: Add user to workspace_members OR adjust RLS policy

- [ ] Test end-to-end commenting workflow (3h)
  - Create hashtag campaign
  - Verify N8N discovers posts
  - Check AI generates comments
  - Confirm comments post to LinkedIn

---

### 📬 PHASE 2: Reply Agent HITL (Week 3-5)

**Phase 2A: Reply Agent UI (Week 3-4 - 27h)**

- [ ] Build `/replies/[replyId]` page (8h)
- [ ] ProspectCard component (3h)
- [ ] ReplyPreview component (3h)
- [ ] DraftEditor component (4h)
- [ ] ActionButtons component (3h)
- [ ] Test approve flow (2h)
- [ ] Test edit flow (2h)
- [ ] Test refuse flow (2h)

**Phase 2B: Infrastructure Setup (Week 5 - 9h)**

- [ ] Setup Postmark MX records (2h)
  - DNS: `sam.innovareai.com MX 10 inbound.postmarkapp.com`

- [ ] Configure inbound webhook (1h)
  - URL: `https://app.meet-sam.com/api/webhooks/postmark-inbound`

- [ ] Test email reception (2h)
- [ ] Test end-to-end workflow (4h)
  - Reply → Draft → Approve → Send

---

### 💬 PHASE 3: SAM Email Conversations (Week 6-7)

**Total Time: 19h**

- [ ] Build SAM email conversation API (8h)
  - File: `/api/webhooks/sam-email-conversation/route.ts`

- [ ] Create conversations table migration (2h)
  - Table: `sam_email_conversations`

- [ ] Build conversation history (4h)

- [ ] Setup hello@sam.innovareai.com (2h)
  - Postmark inbound configuration

- [ ] Test user → SAM conversation (3h)
  - Simple query, follow-up, data query tests

---

### ⚙️ PHASE 4: Account Management (Week 8-9)

**Total Time: 22h**

- [ ] API: GET pending invitations (4h)
  - Endpoint: `/api/linkedin/pending-invitations`

- [ ] API: DELETE invitation (3h)
  - Withdraw pending connection requests

- [ ] API: GET InMail credits (3h)
  - Check Sales Navigator credits

- [ ] UI: Account health widget (6h)
  - Show CR limits (daily/weekly)
  - Pending invitations count
  - Warning alerts

- [ ] UI: Manage invitations modal (6h)
  - Table of pending invitations
  - Bulk withdraw stale invitations (>14 days)

---

### 🎯 PHASE 5: New Campaign Types (Week 10-12)

**Total Time: 24h**

- [ ] **Advanced Search (Week 10 - 14h)**
  - API: Sales Navigator search (6h)
  - UI: Advanced search tab (8h)

- [ ] **Skill Endorsement (Week 11 - 14h)**
  - API: Skill endorsement campaign (8h)
  - UI: Endorsement campaign card (6h)

- [ ] **InMail + Polish (Week 12 - 10h)**
  - UI: InMail campaign card (6h)
  - UI: Account status badges (4h)

---

### 📊 PROGRESS TRACKING

**Week-by-Week Milestones:**

| Week | Phase | Status |
|------|-------|--------|
| 0 | Immediate fixes | ⏳ Pending |
| 1 | Campaign Hub buttons | ⏳ Pending |
| 2 | Commenting agent | ⏳ Pending |
| 3-4 | Reply Agent UI | ⏳ Pending |
| 5 | Postmark setup | ⏳ Pending |
| 6-7 | SAM Email | ⏳ Pending |
| 8-9 | Account Mgmt | ⏳ Pending |
| 10 | Advanced Search | ⏳ Pending |
| 11 | Skill Endorsement | ⏳ Pending |
| 12 | InMail + Polish | ⏳ Pending |

**Current Sprint:** Week 0 (Immediate fixes)

**Last Updated:** November 15, 2025

---

## 🔴 RECENT CRITICAL FIXES (Nov 10 - Dec 16)

### ✅ Anti-Detection Randomizer Integration (Dec 16, 2025)

**Full integration of `lib/anti-detection/message-variance.ts` into send queue:**

**MESSAGE_HARD_LIMITS now enforced:**
| Limit | Value | Status |
|-------|-------|--------|
| MIN_CR_GAP_MINUTES | 20 min | ✅ Enforced |
| MAX_CONNECTION_REQUESTS_PER_DAY | 25 | ✅ Enforced |
| MAX_MESSAGES_PER_DAY | 50 | ✅ Enforced |
| MAX_CONNECTION_REQUESTS_PER_HOUR | 5 | ✅ Enforced (burst protection) |
| MAX_MESSAGES_PER_HOUR | 10 | ✅ Enforced (burst protection) |
| MAX_OPEN_INMAILS_PER_MONTH | 100 | ✅ Added |

**Randomizer functions integrated:**
- `getPreSendDelayMs()` - 30-90s delays (capped at 15s for serverless)
- `getMessageVarianceContext()` - tone/style/length variance per prospect
- `MESSAGE_HARD_LIMITS` - all limits from centralized config

**Files modified:**
- `/app/api/cron/process-send-queue/route.ts` - Uses MESSAGE_HARD_LIMITS
- `/lib/anti-detection/message-variance.ts` - Added MAX_OPEN_INMAILS_PER_MONTH

**Commits:**
- `d16bcaf8` - enforce 20-minute minimum spacing
- `4e0de842` - integrate anti-detection randomizer
- `ee322253` - use MESSAGE_HARD_LIMITS from randomizer
- `95b83279` - integrate all MESSAGE_HARD_LIMITS
- `5ef4b082` - add MAX_OPEN_INMAILS_PER_MONTH

---

### ✅ Resolved Issues

0. **Campaigns Not Showing in UI** (Nov 27) - **CRITICAL**
   - **Root cause:** API response format mismatch
   - API returns `{ success: true, data: { campaigns: [...] } }` via `apiSuccess()`
   - Frontend was reading `result.campaigns` (undefined) instead of `result.data.campaigns`
   - Also fixed N+1 query timeout (4 queries/campaign → 2 batch queries total)
   - Files fixed: `/app/api/campaigns/route.ts`, `/app/components/CampaignHub.tsx`
   - **REMEMBER:** All APIs use `apiSuccess()` which wraps data in `{ success, data, timestamp }`
   - Status: ✅ RESOLVED

1. **RLS Infinite Recursion** (Nov 10)
   - Fixed workspace isolation (users were seeing all 12 workspaces)
   - Changed `workspace_members` policies to direct checks
   - Status: ✅ RESOLVED

2. **CSV Upload Pipeline** (Nov 10)
   - Fixed CSV upload, batch numbers, LinkedIn URL capture
   - End-to-end working
   - Remaining: N8N Docker needs `UNIPILE_DSN` env var

3. **Prospect Name Extraction** (Nov 13)
   - Fixed names showing as LinkedIn usernames
   - Added validation library
   - Status: ✅ RESOLVED

4. **N8N Field Names** (Nov 13)
   - Fixed camelCase vs snake_case mismatch
   - Code updated, N8N workflows need manual update
   - Status: ⚠️ Partially complete

5. **Campaign Metrics** (Nov 12)
   - Fixed dashboard showing 0 metrics
   - Status: ✅ RESOLVED

6. **N8N Campaign Execution - Prospect ID Field Structure** (Nov 15)
   - Fixed "undefined, campaign_id: undefined [line 13, for item 0] (Missing required fields - prospect_id)"
   - Root cause: API sent `prospect_id` but N8N expected `prospect.id`
   - N8N Campaign Handler stores entire prospect object in `item.prospect`
   - "Update Status - CR Sent" node accesses `$input.item.json.prospect.id`
   - Fix: Changed payload from `{prospect_id: "...", id: "..."}` to `{id: "..."}`
   - File: `/app/api/campaigns/linkedin/execute-via-n8n/route.ts` (lines 940-978)
   - Commit: 5ca571b0
   - Status: ✅ RESOLVED

7. **LinkedIn Search Failing** (Nov 22)
   - Error: "Technical error while starting the search"
   - Root cause: Unipile API key in production was invalid/missing
   - Diagnosis: Tested Unipile API directly - got 401 "Missing credentials"
   - Fix: Updated to correct API key via Netlify CLI:
     ```bash
     netlify env:set UNIPILE_API_KEY "POcBmCSV.b/t0gstHvY5alDsy/BmKQmUBt4FmNXRF7fdOYqywJSM="
     netlify env:set UNIPILE_DSN "api6.unipile.com:13670"
     netlify deploy --prod
     ```
   - Key Learning: `.env.local` only works for local dev - production needs `netlify env:set`
   - Verification: Search returned 2 marketing prospects in Berlin ✅
   - Status: ✅ RESOLVED

8. **LinkedIn Connection Requests + CRITICAL Unipile Profile Lookup Bug** (Nov 22 - FINAL FIX)

   **CRITICAL BUG DISCOVERED & FIXED:**
   - Unipile's `/api/v1/users/profile?identifier=` endpoint **returns WRONG profiles** for LinkedIn vanity URLs containing numbers
   - Example: `noah-ottmar-b59478295` was returning **Jamshaid Ali's profile** (with withdrawn invitation) instead of Noah Ottmar
   - This caused legitimate prospects to be incorrectly rejected with "Invitation previously withdrawn" error
   - CR never reached LinkedIn because system detected false withdrawn invitation before sending

   **Root causes identified:**
     1. ❌ BROKEN ENDPOINT: `/api/v1/users/profile?identifier={vanity}` - Returns WRONG person for vanities with numbers
     2. ✅ CORRECT ENDPOINT: `/api/v1/users/{vanity}?account_id=...` - Legacy endpoint correctly resolves all vanities

   **Architecture fixes implemented (Nov 22 - DEPLOYED & VERIFIED):**
     1. **Send connection requests** (`/app/api/campaigns/direct/send-connection-requests/route.ts`):
        - **NEVER use** `/api/v1/users/profile?identifier=` for profile lookup (returns wrong profiles)
        - **PRIMARY:** Use stored `provider_id` with `/api/v1/users/profile?provider_id=` (most reliable)
        - **FALLBACK:** Use legacy `/api/v1/users/{vanity}?account_id=` endpoint (correctly resolves vanities with numbers)
        - Extract vanity from URL using regex: `/linkedin\.com\/in\/([^\/\?#]+)/`
     2. **Process follow-ups** (`/app/api/campaigns/direct/process-follow-ups/route.ts`):
        - Same two-tier strategy: provider_id → legacy endpoint (NO profile?identifier=)
     3. **Poll accepted connections** (`/app/api/cron/poll-accepted-connections/route.ts`):
        - Same two-tier strategy: provider_id → legacy endpoint (NO profile?identifier=)

   **Verification & Testing:**
   - Tested with Noah Ottmar (`noah-ottmar-b59478295`)
   - Profile lookup now returns **correct Noah Ottmar profile** (no false withdrawn invitation)
   - CR successfully sent to LinkedIn: "Hi Noah, I noticed you're studying Business Marketing at SDSU..."
   - Confirms fix works for vanity URLs with numbers

   **Impact:**
   - Fixes all prospects with numbers in LinkedIn vanity URLs
   - CRs will no longer fail with false "invitation withdrawn" errors
   - System now aligns with Unipile's own API recommendations

   **Critical Code Comments Added:**
   - Line 133-141 (poll-accepted-connections): "CRITICAL BUG FIX (Nov 22): profile?identifier= returns WRONG profiles for vanities with numbers"
   - Line 117-131 (process-follow-ups): Same warning
   - Lines 209-222 (send-connection-requests): Explicit DO NOT USE comments

   **Files fixed:**
     - `/app/api/campaigns/direct/send-connection-requests/route.ts` ✅
     - `/app/api/campaigns/direct/process-follow-ups/route.ts` ✅
     - `/app/api/cron/poll-accepted-connections/route.ts` ✅

   **Deployed:** November 22, 2025, 4:05 PM UTC (production verified working)
   **Status:** ✅ CRITICAL BUG FIXED & VERIFIED WITH REAL TEST CASE (Noah Ottmar)

9. **Queue-Based Campaign System** (Nov 22 - PRODUCTION READY & TESTED)

   **✅ COMPLETED AND VERIFIED:**
   - Queue creation endpoint `/api/campaigns/direct/send-connection-requests-queued` (410 lines)
   - Cron processing endpoint `/api/cron/process-send-queue` (258 lines)
   - Database schema (`send_queue` table) created and tested in Supabase
   - Weekend/holiday blocking with 11+ US holidays (2025-2026)
   - Netlify scheduled functions enabled and running every minute
   - End-to-end tested: First CR successfully sent to Geline Clemente (Brand Manager at Danone - Australia & New Zealand)

   **HOW IT WORKS:**
   1. **Queue Creation**: POST `/api/campaigns/direct/send-connection-requests-queued` validates all prospects and creates queue records (returns in <2 seconds)
   2. **Scheduling**: Messages spaced 30 minutes apart (`prospectIndex * 30` minutes from queue time)
   3. **Business Hours**: Messages automatically skip weekends and public holidays, preserving scheduled time
   4. **Cron Processing**: Netlify scheduled functions call POST `/api/cron/process-send-queue` every minute, processing exactly 1 message
   5. **Sending**: Successfully sends CRs via Unipile API, updates queue and prospect records
   6. **Rate Limiting**: 1 CR every 30 minutes = 20 CRs per 10 hours (never exceeds LinkedIn's daily limit)

   **KEY FILES:**
   - `/app/api/campaigns/direct/send-connection-requests-queued/route.ts` - Queue creation (410 lines)
   - `/app/api/cron/process-send-queue/route.ts` - Cron processor (258 lines)
   - `/sql/migrations/011-create-send-queue-table.sql` - Database schema
   - `/docs/QUICK_START.md` - 5-minute setup guide
   - `/docs/IMPLEMENTATION_COMPLETE.md` - Full reference (2500+ lines)
   - `/docs/QUEUE_TESTING_SETUP.md` - Testing guide
   - `/docs/QUEUE_SYSTEM_COMPLETE.md` - System architecture

   **CRON CONFIGURATION (Netlify Scheduled Functions):**
   - Function: `netlify/functions/process-send-queue.ts`
   - Schedule: Every minute
   - Uses internal `x-cron-secret` for auth

   **PRODUCTION VERIFICATION:**
   - Tested with real campaign (5 prospects)
   - First CR confirmed sent and visible in LinkedIn (Geline Clemente)
   - Prospect record correctly updated: `connection_request_sent` status
   - Follow-up automatically scheduled (3 days out)
   - Zero errors in Netlify logs
   - All RLS policies working correctly

   **WEEKEND/HOLIDAY BEHAVIOR:**
   - Saturdays & Sundays: Automatically skipped
   - 2025-2026 US Holidays: Thanksgiving, Christmas, New Year's, MLK Day, Presidents Day, Memorial Day, Independence Day, Labor Day, Veterans Day
   - Preserves scheduled time: Friday 3:00 PM → Monday 3:00 PM (not 9:00 AM)
   - Example: Queue 5 prospects Friday 3:00 PM → CR 1-4 send Friday, CR 5 moves to Monday 5:00 PM

   **DATABASE SCHEMA:**
   ```sql
   CREATE TABLE send_queue (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     campaign_id UUID NOT NULL REFERENCES campaigns(id),
     prospect_id UUID NOT NULL REFERENCES campaign_prospects(id),
     linkedin_user_id TEXT NOT NULL,
     message TEXT NOT NULL,
     scheduled_for TIMESTAMP NOT NULL,
     sent_at TIMESTAMP,
     status VARCHAR(50) NOT NULL DEFAULT 'pending',
     error_message TEXT,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW(),
     UNIQUE(campaign_id, prospect_id)
   );
   ```

   **MONITORING:**
   - Real-time logs: `netlify logs --function process-send-queue --tail`
   - Queue status (Supabase SQL): `SELECT status, COUNT(*) FROM send_queue WHERE campaign_id = '...' GROUP BY status;`
   - LinkedIn verification: LinkedIn → My Network → Invitations sent

   **Status:** ✅ DEPLOYED TO PRODUCTION, TESTED & VERIFIED (November 22, 2025)

### 🔴 Open Issues

1. **LinkedIn Commenting Agent** (Nov 11)
   - Campaign creation failing with "Internal server error"
   - Need browser console logs to diagnose
   - Likely: RLS policy or workspace membership issue

---

## 📅 MEETING AGENT (Dec 16, 2025)

**Status:** ✅ DEPLOYED & READY FOR TESTING

### What It Does

Full meeting lifecycle management when prospects share their Calendly/Cal.com booking links:

1. **Booking Detection** - Detects Calendly, Cal.com, HubSpot, Google, Microsoft booking URLs
2. **Slot Scraping** - Uses Bright Data to scrape available slots from prospect's booking page
3. **Calendar Conflict Check** - Checks our calendar via Unipile before booking
4. **Auto-Booking** - Books the first available slot (or lets user choose)
5. **Calendar Sync** - Syncs booked meeting to our calendar via Unipile
6. **Automated Reminders** - Sends 24h, 1h, 15m reminders via Postmark
7. **No-Show Detection** - Detects meetings past scheduled time without completion
8. **AI Follow-Ups** - Generates contextual follow-ups for no-shows, cancellations, post-meeting
9. **HITL Approval** - All AI-generated follow-ups require human approval before sending

### Key Files

**Core Services:**
- `lib/services/meeting-agent.ts` - Meeting lifecycle logic, booking link detection, AI follow-up generation
- `lib/services/calendly-scraper.ts` - Bright Data scraper for Calendly/Cal.com slots

**API Endpoints:**
- `app/api/meeting-agent/book/route.ts` - Booking endpoint (detects links, scrapes slots, books)

**Cron Jobs:**
- `app/api/cron/check-meeting-status/route.ts` - Every 15 min, detects no-shows/cancellations
- `app/api/cron/send-meeting-reminders/route.ts` - Every 5 min, sends 24h/1h/15m reminders
- `app/api/cron/send-meeting-follow-ups/route.ts` - Every 15 min, sends approved follow-ups

**Netlify Scheduled Functions:**
- `netlify/functions/check-meeting-status.ts` - Wrapper for cron
- `netlify/functions/send-meeting-reminders.ts` - Wrapper for cron
- `netlify/functions/send-meeting-follow-ups.ts` - Wrapper for cron

**Database Migration:**
- `sql/migrations/053-create-meetings-table.sql` - Creates `meetings`, `meeting_reminders`, `meeting_follow_up_drafts`, `booking_platforms` tables

### Database Schema

```sql
-- Main meetings table
meetings (
  id, prospect_id, workspace_id, campaign_id,
  booking_url, booking_platform, scheduled_at, duration_minutes,
  meeting_link, meeting_platform,
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'no_show' | 'completed' | 'rescheduled',
  reminder_24h_sent_at, reminder_1h_sent_at, reminder_15m_sent_at,
  no_show_follow_up_sent_at, post_meeting_follow_up_sent_at,
  outcome, next_steps, notes
)

-- Reminder queue
meeting_reminders (
  id, meeting_id, workspace_id,
  reminder_type: '24h' | '1h' | '15m',
  scheduled_for, status: 'pending' | 'sent' | 'cancelled' | 'failed'
)

-- HITL follow-up drafts
meeting_follow_up_drafts (
  id, meeting_id, prospect_id, workspace_id,
  follow_up_type: 'no_show' | 'cancelled' | 'post_meeting' | 'reschedule',
  subject, message, channel: 'email' | 'linkedin',
  status: 'pending_generation' | 'pending_approval' | 'approved' | 'sent' | 'rejected'
)

-- Supported platforms
booking_platforms (
  platform_name: 'calendly' | 'cal.com' | 'hubspot' | 'google_calendar' | 'microsoft_bookings',
  url_pattern, scrape_enabled, booking_enabled
)
```

### How Booking Works

1. Reply Agent detects Calendly link in prospect's message
2. Calls `POST /api/meeting-agent/book` with `{ prospect_id, booking_url, auto_book: true }`
3. Meeting Agent scrapes available slots via Bright Data
4. Checks our calendar for conflicts via Unipile Calendar API
5. Books first available non-conflicting slot
6. Creates meeting record and schedules reminders
7. Syncs event to our calendar

### Cron Schedules (netlify.toml)

```toml
[functions."check-meeting-status"]
  schedule = "*/15 * * * *"   # Every 15 minutes

[functions."send-meeting-reminders"]
  schedule = "*/5 * * * *"    # Every 5 minutes

[functions."send-meeting-follow-ups"]
  schedule = "*/15 * * * *"   # Every 15 minutes
```

### Environment Variables Required

- `BRIGHT_DATA_BROWSER_WS` - Bright Data Scraping Browser WebSocket URL
- `POSTMARK_SERVER_TOKEN` - For sending email reminders/follow-ups
- `POSTMARK_FROM_EMAIL` - Default sender email
- `OPENROUTER_API_KEY` - For AI-generated follow-ups
- `UNIPILE_DSN`, `UNIPILE_API_KEY` - For calendar sync

### Testing

```bash
# Monitor meeting status cron
netlify logs:function check-meeting-status --tail

# Monitor reminders
netlify logs:function send-meeting-reminders --tail

# Check pending reminders
SELECT * FROM meeting_reminders WHERE status = 'pending' ORDER BY scheduled_for;

# Check meetings
SELECT * FROM meetings WHERE status = 'scheduled' ORDER BY scheduled_at;
```

---

## 📋 QUICK REFERENCE

### Database
- **Supabase URL:** https://latxadqrvrrrcvkktrog.supabase.co
- **Workspace ID (InnovareAI):** `babdcab8-1a78-4b2f-913e-6e9fd9821009`

### Production
- **URL:** https://app.meet-sam.com
- **Status:** ✅ FULLY OPERATIONAL
- **Latest Deploy:** November 22, 2025 (Unipile API key + CR header fix)
- **Campaign Status:** ✅ Connection requests now sending successfully

### N8N
- **URL:** https://workflows.innovareai.com
- **Main Workflow ID:** `aVG6LC4ZFRMN7Bw6` (SAM Master Campaign Orchestrator)

### Key Files
- **Campaign Hub:** `app/components/CampaignHub.tsx`
- **Commenting Agent:** `app/api/linkedin-commenting/monitors/route.ts`
- **CSV Upload:** `app/api/prospect-approval/upload-csv/route.ts`

---

## 🚨 CRITICAL SAFETY RULES

### Directory Restrictions
**LOCKED TO:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7`

**NEVER ACCESS:**
- ❌ `/Users/tvonlinz/Dev_Master/3cubed/` (killed this project before)
- ❌ `/Users/tvonlinz/Dev_Master/SEO_Platform/` (killed this project before)
- ❌ Any path without `Sam-New-Sep-7`

**BEFORE EVERY FILE OPERATION:**
```bash
pwd  # Must return: /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
```

### Multi-Tenant Safety
- Always use `workspace_members` table (NOT `workspace_users` - doesn't exist)
- Check RLS policies - they can silently block operations
- Use service role key for admin operations
- Test with regular user permissions, not just super admin

---

## 📚 KEY DOCUMENTATION

### Recent Handover Docs
- **`SAM_FEATURE_ROLLOUT_PLAN.md`** - Complete 12-week plan (Nov 12)
- **`HANDOVER_LINKEDIN_COMMENTING_AGENT.md`** - Commenting agent debug (Nov 11)
- **`HANDOVER_CSV_PIPELINE_N8N_FIX.md`** - CSV pipeline fixes (Nov 10)
- **`docs/RLS_INFINITE_RECURSION_FIX.md`** - RLS recursion fix (Nov 10)
- **`docs/fixes/COMPLETE_FIX_SUMMARY.md`** - Recent fixes summary (Nov 13)

### Technical Documentation
- **`docs/INFRASTRUCTURE.md`** - **READ THIS FIRST** - Complete infrastructure guide (Nov 27)
  - Architecture diagram, API endpoints, database tables
  - Unipile integration, cron jobs, deployment
  - Common issues & fixes, monitoring queries
- **`docs/LINKEDIN_COMMENTING_AGENT.md`** - Complete LinkedIn Commenting Agent documentation (Dec 16)
  - AI comment generation, quality scoring, performance tracking
  - Author relationship memory, anti-detection, brand guidelines
  - 10,000+ lines of code across 60+ files
- **`docs/LINKEDIN_MESSAGING_AGENT.md`** - Complete LinkedIn/Email Messaging Agent documentation (Dec 16)
  - Queue-based campaign execution, rate limiting, multi-country support
  - Reply detection, follow-up automation, Unipile integration
  - 8,000+ lines of code across 50+ files
- **`docs/MEETING_AGENT.md`** - Meeting Agent documentation (Dec 16)
  - Booking detection (Calendly, Cal.com, HubSpot), slot scraping via Bright Data
  - Automated reminders (24h, 1h, 15m), no-show detection, AI follow-ups
  - HITL approval for all follow-up messages
- **`SAM_SYSTEM_TECHNICAL_OVERVIEW.md`** - System architecture (1083 lines)
- **`README.md`** - Quick start and deployment guide
- **`TODO.md`** - Current tasks (last updated Oct 20)

### Onboarding
- **`QUICK_START_GUIDE.md`** - 5-minute quick start
- **`NEW_ASSISTANT_ONBOARDING.md`** - 30-minute detailed onboarding

---

## 🚨🚨🚨 CRITICAL: READ THIS FIRST - DIRECTORY SAFETY 🚨🚨🚨

### ⛔ ABSOLUTE DIRECTORY RESTRICTION - ZERO TOLERANCE ⛔

**YOU ARE LOCKED TO THIS DIRECTORY ONLY:**
```
/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
```

### 🔴 BEFORE EVERY SINGLE FILE OPERATION:

**1. VERIFY YOUR CURRENT DIRECTORY:**
```bash
pwd  # MUST return: /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
```

**2. IF YOU SEE ANY OTHER PATH - STOP IMMEDIATELY**

**3. NEVER USE THESE COMMANDS:**
- ❌ `cd ..` (goes to parent directory)
- ❌ `cd ~` (goes to home directory)
- ❌ `cd /Users/tvonlinz/Dev_Master` (parent directory)
- ❌ Relative paths that go up: `../../`

**4. BANNED DIRECTORIES - NEVER ACCESS:**
- ❌ `/Users/tvonlinz/Dev_Master/3cubed/` **(killed this project before)**
- ❌ `/Users/tvonlinz/Dev_Master/SEO_Platform/` **(killed this project before)**
- ❌ `/Users/tvonlinz/Dev_Master/sam/` (different project)
- ❌ `/Users/tvonlinz/Dev_Master/` (parent directory)
- ❌ Any path that doesn't contain `Sam-New-Sep-7`

### 🛡️ MANDATORY SAFETY PROTOCOL:

**BEFORE writing, editing, or reading ANY file:**

1. Run `pwd` to verify you're in the correct directory
2. Check the file path contains `/Sam-New-Sep-7/`
3. If unsure, ASK THE USER before proceeding
4. NEVER assume a file location

---

## Project Overview

**SAM AI** is a B2B sales automation platform combining AI-powered conversational assistance with multi-channel campaign management (LinkedIn + Email). The system uses a multi-tenant architecture targeting $100M ARR by 2027.

### Core Technology Stack

- **Framework**: Next.js 15.5.2 (App Router) + React 18 + TypeScript
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth with workspace-based multi-tenancy
- **AI/LLM**: OpenRouter API (Claude 3.5 Sonnet primary)
- **Integrations**: Unipile (LinkedIn/Email), N8N (workflow automation)
- **Email**: Postmark (transactional), Unipile/ReachInbox (campaigns)
- **Deployment**: Netlify (frontend/API) + Supabase Cloud

### Production Environment

- **Production**: https://app.meet-sam.com
- **Staging**: https://devin-next-gen-staging.netlify.app
- **Database**: Supabase multi-tenant PostgreSQL
- **Status**: Live with paying customers

---

## Architecture Patterns

### Multi-Tenant Isolation

All data is workspace-isolated using Supabase RLS policies:

```typescript
// CRITICAL: Always use workspace_members, NOT workspace_users
const { data } = await supabase
  .from('workspace_prospects')
  .select('*')
  .eq('workspace_id', workspaceId);
// RLS automatically filters by auth.uid() membership
```

**Key Tables:**
- `workspaces` - Tenant containers
- `workspace_members` - User access control (use this table)
- `workspace_prospects` - CRM contacts
- `campaigns` - Campaign definitions
- `knowledge_base` - RAG knowledge store with vector embeddings

### App Directory Structure

```
app/
├── api/                    # Next.js API routes
│   ├── campaign/          # Campaign execution APIs
│   ├── sam/               # SAM AI conversation APIs
│   ├── workspace/         # Workspace management
│   ├── prospect-approval/ # HITL approval system
│   └── linkedin/          # LinkedIn integration
├── workspace/[workspaceId]/ # Workspace dashboard pages
├── demo/                   # Demo tenant pages
└── providers/              # React context providers

lib/
├── services/              # Business logic services
├── mcp/                   # MCP tool integrations
├── n8n/                   # N8N workflow client
├── ai/                    # AI/LLM utilities
└── supabase-knowledge.ts  # RAG integration

components/                # React components
```

### MCP Integration Pattern

SAM AI uses Model Context Protocol (MCP) for external integrations:

```typescript
// Available MCP tools
mcp__unipile__unipile_get_accounts()        // LinkedIn/email accounts
mcp__unipile__unipile_get_recent_messages() // Message history
mcp__n8n_self_hosted__list_workflows()     // N8N workflows
```

**Configuration**: `.mcp.json` (local dev) and `.mcp-dev.json` (production)

### Campaign Execution Flow

```
1. User creates campaign → `/api/campaign/create`
2. Prospects approved → `/api/prospect-approval/*`
3. N8N workflow triggered → `lib/n8n/n8n-client.ts`
4. Messages sent via Unipile → MCP tools
5. Replies monitored → HITL approval system
6. SAM AI generates responses → `/api/sam/threads`
```

### Knowledge Base (RAG) System

```typescript
// Vector search for SAM AI context
const knowledge = await supabase.rpc('search_knowledge', {
  query_embedding: embedding,
  match_threshold: 0.8,
  match_count: 5,
  workspace_id: workspaceId
});
// Used in SAM conversations for contextual responses
```

**Tables:**
- `knowledge_base` - Main content with vector embeddings
- `knowledge_base_sections` - Organizational hierarchy

---

## Common Development Tasks

### Development Commands

```bash
# Development
npm run dev                    # Start dev server (localhost:3000)
npm run build                  # Production build
npm run lint                   # Run ESLint

# Testing
npm run test:kb-crud          # Test knowledge base CRUD
npm run test:sam-threads      # Test SAM conversations
npm run test:integration      # Integration tests

# Deployment
npm run deploy:staging        # Deploy to staging environment
npm run deploy:production     # Deploy all tenants to production

# Database
npm run seed:kb-simple        # Seed knowledge base
npm run migrate:kb            # Migrate legacy KB

# Monitoring
npm run monitoring:health     # Check production health
npm run monitoring:metrics    # View system metrics
npm run monitoring:alerts     # Check alerts

# Documentation
npm run update-docs           # Auto-update documentation
```

### Running Tests

```bash
# Test LinkedIn integration
node scripts/test-unipile-direct.js

# Test N8N workflows
node scripts/test-n8n-integration.ts

# Test prospect approval
node test-campaign-execution.cjs
```

### Database Operations

**Always test SQL in staging first:**

```bash
# Check current schema
curl https://devin-next-gen-staging.netlify.app/api/admin/check-schema

# Apply migrations via Supabase dashboard SQL editor
# Never run SQL directly in production without validation
```

### Working with MCP Tools

```bash
# Test MCP tool availability
curl http://localhost:3000/api/mcp

# View MCP configuration
cat .mcp.json
```

---

## Critical Development Guidelines

### Multi-Tenant Safety

```typescript
// ✅ CORRECT: Use workspace_members for user access
const { data: members } = await supabase
  .from('workspace_members')
  .select('*, users(*)')
  .eq('workspace_id', workspaceId);

// ❌ WRONG: workspace_users table doesn't exist
const { data } = await supabase
  .from('workspace_users')  // This will fail
  .select('*');
```

### Tier-Based Feature Access

```typescript
// Check workspace tier before enabling features
const { data: tier } = await supabase
  .from('workspace_tiers')
  .select('tier_name, features')
  .eq('workspace_id', workspaceId)
  .single();

// Tier levels: 'startup' ($99), 'sme' ($399), 'enterprise' ($899)
if (tier.tier_name === 'enterprise') {
  // Enable ReachInbox integration
}
```

### API Route Patterns

```typescript
// Standard API route structure
export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });

    // 2. Parse request
    const body = await request.json();

    // 3. Validate workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', body.workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) return new Response('Forbidden', { status: 403 });

    // 4. Execute business logic
    const result = await performAction(body);

    return Response.json(result);
  } catch (error) {
    console.error('API Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

### Environment Variables

**Required for development:**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# OpenRouter AI
OPENROUTER_API_KEY=<openrouter_key>

# Postmark Email
POSTMARK_SERVER_TOKEN=<postmark_token>

# Unipile (LinkedIn/Email)
UNIPILE_DSN=<unipile_dsn>
UNIPILE_API_KEY=<unipile_key>

# N8N Workflows
N8N_WEBHOOK_URL=https://workflows.innovareai.com
N8N_API_KEY=<n8n_key>
```

**Never commit `.env.local` or expose service role keys.**

**Setting Environment Variables in Production (Netlify):**

⚠️ **CRITICAL:** `.env.local` changes do NOT apply to production. Use Netlify CLI:

```bash
# View all env vars
netlify env:list

# Set a variable
netlify env:set VARIABLE_NAME "value"

# Deploy after updating env vars
netlify deploy --prod
```

**Example - Updating Unipile Credentials:**
```bash
netlify env:set UNIPILE_DSN "api6.unipile.com:13670"
netlify env:set UNIPILE_API_KEY "POcBmCSV.b/t0gstHvY5alDsy/BmKQmUBt4FmNXRF7fdOYqywJSM="
netlify deploy --prod
```

**Current Production Environment Variables (Nov 22, 2025):**
- `UNIPILE_DSN`: `api6.unipile.com:13670`
- `UNIPILE_API_KEY`: `POcBmCSV.b/t0gstHvY5alDsy/BmKQmUBt4FmNXRF7fdOYqywJSM=`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: Supabase credentials
- Plus 10+ other API keys (see `netlify env:list` for full list)

---

## High-Level System Features

### Implemented (85% Complete)

- ✅ Multi-tenant workspace architecture with RLS
- ✅ SAM AI conversational assistant with RAG
- ✅ LinkedIn campaign automation (Unipile integration)
- ✅ Email campaign system (Unipile + ReachInbox)
- ✅ N8N workflow automation integration
- ✅ HITL (Human-in-the-Loop) approval system
- ✅ Prospect management and CRM
- ✅ Knowledge base with vector search
- ✅ Campaign analytics and reporting
- ✅ Workspace member management

### In Progress (10% Complete)

- ⚠️ Advanced AI model configuration
- ⚠️ Mobile application support
- ⚠️ Advanced team collaboration features
- ⚠️ Custom CRM integrations (Salesforce, HubSpot)

### Planned (5% Complete)

- ❌ Billing and subscription management
- ❌ Voice calling integration
- ❌ White-label solutions
- ❌ Enterprise SSO
- ❌ Advanced compliance (HIPAA, SOC2)

---

## Important File References

### Strategic Documentation

- **`/docs/sam-ai/sam-ai-product-development-roadmap.md`** - 3-year product roadmap
- **`/docs/sam-ai/sam-ai-service-model-plans.md`** - Pricing and service tiers
- **`/docs/sam-ai/sam-ai-compliance-framework.md`** - Compliance strategy
- **`/docs/sam-ai/rag-data-storage-strategy.md`** - RAG implementation

### Technical Documentation

- **`docs/INFRASTRUCTURE.md`** - Complete infrastructure guide
- **`docs/LINKEDIN_COMMENTING_AGENT.md`** - LinkedIn Commenting Agent (Dec 16, 2025)
- **`docs/LINKEDIN_MESSAGING_AGENT.md`** - LinkedIn/Email Messaging Agent (Dec 16, 2025)
- **`SAM_SYSTEM_TECHNICAL_OVERVIEW.md`** - Complete system architecture (1083 lines)
- **`README.md`** - Quick start and deployment guide
- **`TODO.md`** - Current tasks and priorities
- **`DEPLOYMENT_CHECKLIST.md`** - Production deployment steps

### Onboarding

- **`QUICK_START_GUIDE.md`** - 5-minute quick start
- **`NEW_ASSISTANT_ONBOARDING.md`** - 30-minute detailed onboarding

---

## Absolute Guardrails

### Directory Restrictions (CRITICAL - ALREADY COVERED AT TOP)

**See the CRITICAL section at the top of this file for full directory safety protocol.**

**Quick reminder:**
- ✅ ONLY: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7`
- ❌ NEVER: Any other directory
- 🔴 Always run `pwd` before file operations

### Production Safety

- **Always test in staging first** before production changes
- **Never run SQL directly** in production without validation
- **Check workspace tier** before accessing tier-specific features
- **Use MCP tools** for external service integration
- **Verify RLS policies** protect multi-tenant data

### Anti-Hallucination Protocol

**NEVER create fake implementations:**
- ❌ Mock API integrations that appear real
- ❌ Fake data that simulates real services
- ❌ Placeholder code without clear "TODO" markers

**ALWAYS:**
- ✅ State clearly when something is a specification vs implementation
- ✅ Provide real API documentation links
- ✅ Use obvious placeholders: `// TODO: Implement real [SERVICE] integration`

---

## Troubleshooting Common Issues

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run build
```

### Database Connection Issues

```bash
# Test Supabase connection
node -e "const { createClient } = require('@supabase/supabase-js'); \
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, \
  process.env.SUPABASE_SERVICE_ROLE_KEY); \
  supabase.from('workspaces').select('count').then(console.log);"
```

### MCP Tool Failures

```bash
# Check MCP server status
curl http://localhost:3000/api/mcp

# Verify MCP configuration
cat .mcp.json | jq '.mcpServers'
```

### Authentication Issues

- Verify Supabase auth callback URLs in Supabase dashboard
- Check RLS policies allow workspace access
- Ensure middleware.ts allows necessary routes

---

## Key Architecture Decisions

### Why Next.js 15 App Router?

- Server-side rendering for better SEO and performance
- API routes for backend logic without separate server
- Built-in TypeScript support
- Netlify deployment optimization

### Why Supabase?

- PostgreSQL with built-in RLS for multi-tenancy
- Real-time subscriptions for live updates
- Authentication with magic links
- Serverless architecture with automatic scaling
- Vector embeddings for RAG system

### Why MCP (Model Context Protocol)?

- Standardized tool integration for AI systems
- Live data access for SAM AI conversations
- Extensible architecture for new integrations
- Security through controlled tool access

### Why N8N for Campaigns?

- Visual workflow builder for campaign automation
- Self-hosted for data control
- Webhook support for real-time events
- Per-workspace workflow instances
- Complex multi-step campaign sequences

---

## Performance Considerations

### Database Optimization

- Use database indexes on frequently queried columns
- Leverage Supabase views for complex analytics queries
- Implement pagination for large result sets
- Use `select()` to fetch only needed columns

### Caching Strategy

- Next.js automatic caching for static pages
- API response caching with `Cache-Control` headers
- Client-side caching with React Query (future)

### API Rate Limiting

- Unipile: 800 emails/month per account (Startup tier)
- LinkedIn: 100 connection requests/week per account
- OpenRouter: Monitor token usage and costs

---

## Next Steps for New Assistants

1. **Read onboarding docs** (QUICK_START_GUIDE.md, NEW_ASSISTANT_ONBOARDING.md)
2. **Check TODO.md** for current priorities
3. **Test staging environment** to verify access
4. **Review recent git commits** to understand latest changes
5. **Start with highest priority TODO item**

---

**Last Updated**: Auto-generated by `npm run update-docs`
**System Status**: Production (85% complete)
**Target**: $100M ARR by 2027
- i told ya not to fuck with our users
- outbound works