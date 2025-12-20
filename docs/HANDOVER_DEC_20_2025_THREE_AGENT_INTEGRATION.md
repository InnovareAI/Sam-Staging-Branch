# Handover: Three-Agent Integration System

**Date:** December 20, 2025
**Status:** ✅ Complete and Deployed

---

## Summary

Implemented a complete three-agent integration system that enables seamless handoff between the Reply Agent, Calendar Agent, and Follow-up Agent for managing prospect conversations from initial reply through meeting booking and follow-up.

---

## What Was Built

### 1. Calendar Agent Cron Job
**File:** `app/api/cron/calendar-agent/route.ts`

A 5-phase cron job that runs every 2 hours:

| Phase | Purpose |
|-------|---------|
| Phase 1 | Check follow-up triggers (no booking, cancelled, no-show, no response) |
| Phase 2 | Process prospect calendar links (check our availability) |
| Phase 3 | Calendar link clicks without booking (24h follow-up) |
| Phase 4 | Detect no-shows for meetings past scheduled time (15 min grace) |
| Phase 5 | Poll Google Calendar for cancellations via Unipile API |

**Key Implementation Note:** Since Unipile doesn't have calendar webhooks yet, Phase 5 uses polling to detect cancellations by fetching event status via `GET /api/v1/calendar/events/{eventId}`.

### 2. Calendar Agent Service
**File:** `lib/services/calendar-agent.ts`

Core service functions:
- `detectCalendarLinks()` - Detects Calendly, Cal.com, HubSpot, Acuity, Google, Microsoft links
- `hasCalendarLink()` - Quick check if message contains calendar link
- `handleProspectCalendarLink()` - Stores detected prospect calendar links
- `checkGoogleCalendarAvailability()` - Checks our availability via Unipile
- `checkFollowUpTriggers()` - Queries for prospects needing follow-up
- `triggerFollowUp()` - Marks prospects for follow-up agent

### 3. Link Tracking System
**Files:**
- `lib/services/link-tracking.ts` - Core tracking service
- `app/t/[code]/route.ts` - Redirect endpoint

Enables tracking when prospects click links in messages:
- Unique tracked URLs per recipient (`/t/abc123`)
- Click recording with metadata (IP, user agent, timestamp)
- Automatic conversation stage updates on click
- 24-hour follow-up trigger if calendar clicked but no booking

### 4. Reply Agent Integration
**File:** `app/api/cron/reply-agent-process/route.ts`

Added calendar link detection integration:
```typescript
const prospectCalendarLinks = detectCalendarLinks(draft.inbound_message_text || '');
if (prospectCalendarLinks.length > 0) {
  await handleProspectCalendarLink(draft.prospect_id, primaryCalendarLink);
  await updateDraftWithProspectCalendarLink(draft.id, primaryCalendarLink.url);
}
```

---

## Database Migrations

### Migration 058: Agent Integration Tracking
**File:** `sql/migrations/058-agent-integration-tracking.sql`

New columns on `campaign_prospects`:
- `sam_reply_sent_at` - When Reply Agent sent response
- `sam_reply_included_calendar` - Did SAM's reply include calendar link?
- `prospect_calendar_link` - Calendar link sent BY the prospect
- `follow_up_trigger` - What triggered follow-up
- `calendar_follow_up_due_at` - When to check if follow-up needed
- `conversation_stage` - Current stage in conversation

New columns on `reply_agent_drafts`:
- `included_calendar_link` - Did draft include calendar link?
- `prospect_sent_calendar_link` - Calendar link from prospect's message

New column on `meetings`:
- `source_reply_draft_id` - Links meeting back to Reply Agent draft

### Migration 060: Link Tracking
**File:** `sql/migrations/060-link-tracking.sql`

New tables:
- `tracked_links` - Unique links per recipient
- `link_clicks` - Click events with metadata

New columns on `campaign_prospects`:
- `first_calendar_click_at`
- `first_demo_click_at`
- `first_pdf_click_at`
- `total_link_clicks`
- `last_link_click_at`

---

## Conversation Stages

| Stage | Description | Next Agent |
|-------|-------------|------------|
| `initial_outreach` | First message sent | Reply Agent (on response) |
| `awaiting_response` | SAM replied, waiting | Calendar Agent (5 days) |
| `awaiting_booking` | Calendar link sent | Calendar Agent (3 days) |
| `prospect_shared_calendar` | Prospect sent their link | Calendar Agent |
| `availability_ready` | Our times found | Reply Agent |
| `calendar_clicked_pending_booking` | Clicked but not booked | Calendar Agent (24h) |
| `meeting_scheduled` | Meeting booked | Calendar Agent (monitor) |
| `meeting_cancelled` | Prospect cancelled | Follow-up Agent |
| `no_show_follow_up` | They didn't show | Follow-up Agent |
| `follow_up_needed` | Generic trigger | Follow-up Agent |
| `meeting_completed` | Meeting happened | - |
| `closed` | Conversation ended | - |

---

## Follow-up Triggers

The Follow-up Agent is triggered by these values in `follow_up_trigger`:
- `no_meeting_booked` - SAM sent calendar link, no booking after 3 days
- `meeting_cancelled` - Prospect cancelled the meeting
- `meeting_no_show` - Prospect didn't show up
- `no_response` - No response 5 days after SAM's reply
- `calendar_clicked_no_booking` - Clicked calendar link but didn't book (24h)

---

## Cron Schedules

| Cron Job | Schedule | Purpose |
|----------|----------|---------|
| `reply-agent-process` | Every 5 min | Generate AI replies |
| `calendar-agent` | Every 2 hours | Check triggers, no-shows, calendars |
| `generate-follow-up-drafts` | Every 15 min | Generate follow-up drafts |

---

## Key Technical Decisions

### 1. Google Calendar Polling (Not Webhooks)
Unipile doesn't have calendar webhooks yet - they're "coming soon". The Calendar Agent uses polling in Phase 5 to detect cancellations:
- Fetches event status via `GET /api/v1/calendar/events/{eventId}?account_id={accountId}`
- 404 response = event deleted/cancelled
- `status: 'cancelled'` in response body = event cancelled

### 2. No Calendly Integration
User confirmed they use Google Calendar, NOT Calendly. The Calendly webhook handler exists but isn't active for this user.

### 3. Link Tracking Architecture
Each prospect gets unique tracked URLs. This enables:
- Per-recipient engagement tracking
- Precise follow-up timing based on clicks
- Analytics on which content resonates

---

## Files Modified/Created

| File | Change |
|------|--------|
| `app/api/cron/calendar-agent/route.ts` | Created - 5-phase cron job |
| `lib/services/calendar-agent.ts` | Created - Core calendar service |
| `lib/services/link-tracking.ts` | Created - Link tracking service |
| `app/t/[code]/route.ts` | Created - Redirect endpoint |
| `sql/migrations/058-agent-integration-tracking.sql` | Created - DB schema |
| `sql/migrations/060-link-tracking.sql` | Created - Link tracking schema |
| `app/api/cron/reply-agent-process/route.ts` | Modified - Added calendar detection |
| `docs/THREE_AGENT_INTEGRATION.md` | Created - Full documentation |
| `docs/INFRASTRUCTURE.md` | Updated - Added Three-Agent section |

---

## Deployment Status

- ✅ Migrations 058 and 060 applied to production Supabase
- ✅ Code deployed to production via `netlify deploy --prod`
- ✅ Documentation added to INFRASTRUCTURE.md

---

## Testing Recommendations

1. **Reply Agent → Calendar Agent handoff:**
   - Have prospect send message with Calendly link
   - Verify `prospect_calendar_link` is populated
   - Verify `conversation_stage = 'prospect_shared_calendar'`

2. **Calendar click tracking:**
   - Send tracked calendar link to test prospect
   - Click the link
   - Verify click is recorded in `link_clicks`
   - Verify `conversation_stage = 'calendar_clicked_pending_booking'`

3. **No-show detection:**
   - Create a meeting with past `scheduled_at`
   - Run calendar-agent cron
   - Verify `follow_up_trigger = 'meeting_no_show'`

4. **Cancellation detection:**
   - Create meeting with `our_calendar_event_id`
   - Delete event from Google Calendar
   - Run calendar-agent cron
   - Verify `follow_up_trigger = 'meeting_cancelled'`

---

## Next Steps (If Continuing)

1. **Configure Netlify Scheduled Function** for calendar-agent cron (every 2 hours)
2. **Add Google Calendar account** to workspace_accounts for testing
3. **Test end-to-end flow** with real prospect
4. **Monitor Phase 5 logs** to ensure Unipile API calls work correctly

---

**Last Updated:** December 20, 2025
