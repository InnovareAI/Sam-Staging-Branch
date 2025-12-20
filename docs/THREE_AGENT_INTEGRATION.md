# Three-Agent Integration System

**Created: December 20, 2025**

This document describes the integration between the Reply Agent, Calendar Agent, and Follow-up Agent.

## Overview

The three-agent system creates a seamless handoff for managing prospect conversations from initial reply through meeting booking and follow-up:

```
Prospect Message → Reply Agent → Calendar Agent → Follow-up Agent
                        ↓               ↓               ↓
                   Generates      Monitors         Sends follow-up
                    Reply         Bookings         if needed
```

## Agent Responsibilities

### 1. Reply Agent (SAM)
**Purpose:** Respond to prospect messages with AI-generated replies

**Triggers Follow-up when:**
- Sets `sam_reply_sent_at` timestamp
- Sets `sam_reply_included_calendar = true` if reply contains calendar link
- Sets `calendar_follow_up_due_at = now + 3 days` if calendar link sent
- Sets `conversation_stage = 'awaiting_booking'` or `'awaiting_response'`

**Key Files:**
- `app/api/reply-agent/[replyId]/action/route.ts` - HITL action handler
- `app/api/cron/reply-agent-process/route.ts` - Draft generation
- `lib/services/reply-draft-generator.ts` - AI draft generation

### 2. Calendar Agent
**Purpose:** Monitor meeting bookings, cancellations, no-shows; check our availability

**Monitors:**
- Calendly webhook events (booking, cancellation, no-show)
- Prospect calendar links in messages
- Meeting status (scheduled → completed/no-show)

**Triggers Follow-up when:**
- No meeting booked 3 days after calendar link sent
- Meeting cancelled by prospect
- No-show detected
- No response 5 days after SAM's reply

**Key Files:**
- `app/api/webhooks/calendly/route.ts` - Calendly webhook handler
- `app/api/cron/calendar-agent/route.ts` - Follow-up trigger checks
- `lib/services/calendar-agent.ts` - Calendar link detection, availability

### 3. Follow-up Agent
**Purpose:** Send follow-up messages when triggered by Calendar Agent

**Triggered by:**
- `follow_up_trigger = 'no_meeting_booked'`
- `follow_up_trigger = 'meeting_cancelled'`
- `follow_up_trigger = 'meeting_no_show'`
- `follow_up_trigger = 'no_response'`

**Key Files:**
- `app/api/cron/generate-follow-up-drafts/route.ts` - Draft generation
- Existing Follow-up Agent infrastructure

## Database Fields

### campaign_prospects (New Columns)

| Column | Type | Description |
|--------|------|-------------|
| `sam_reply_sent_at` | TIMESTAMPTZ | When Reply Agent sent a response |
| `sam_reply_included_calendar` | BOOLEAN | Did SAM's reply include a calendar link? |
| `prospect_calendar_link` | TEXT | Calendar link sent BY the prospect |
| `follow_up_trigger` | TEXT | What triggered follow-up (no_meeting_booked, meeting_cancelled, etc.) |
| `calendar_follow_up_due_at` | TIMESTAMPTZ | When to check if follow-up needed |
| `conversation_stage` | TEXT | Current stage in the conversation |

### reply_agent_drafts (New Columns)

| Column | Type | Description |
|--------|------|-------------|
| `included_calendar_link` | BOOLEAN | Did this draft include a calendar link? |
| `prospect_sent_calendar_link` | TEXT | Calendar link from prospect's message |

### meetings (New Columns)

| Column | Type | Description |
|--------|------|-------------|
| `source_reply_draft_id` | UUID | Links meeting back to Reply Agent draft |

## Conversation Stages

The `conversation_stage` field tracks where the prospect is in the pipeline:

| Stage | Description | Next Agent |
|-------|-------------|------------|
| `initial_outreach` | First message sent | Reply Agent (on response) |
| `awaiting_response` | SAM replied, waiting for them | Calendar Agent (5 days no response) |
| `awaiting_booking` | Calendar link sent, waiting for booking | Calendar Agent (3 days no booking) |
| `prospect_shared_calendar` | Prospect sent their calendar link | Calendar Agent (check our availability) |
| `availability_ready` | Our available times found | Reply Agent (send times) |
| `meeting_scheduled` | Meeting booked | Calendar Agent (monitor) |
| `meeting_completed` | Meeting happened | - |
| `meeting_cancelled` | Prospect cancelled | Follow-up Agent |
| `no_show_follow_up` | They didn't show up | Follow-up Agent |
| `follow_up_needed` | Generic follow-up trigger | Follow-up Agent |
| `closed` | Conversation ended | - |

## Flow Diagrams

### Flow 1: SAM Sends Calendar Link

```
1. Prospect replies to outreach
2. Reply Agent generates draft with calendar link
3. HITL approves, Reply Agent sends
4. Sets: sam_reply_sent_at, sam_reply_included_calendar=true
5. Sets: calendar_follow_up_due_at = now + 3 days
6. Sets: conversation_stage = 'awaiting_booking'

[3 days later, no booking]

7. Calendar Agent cron runs
8. Finds prospects with calendar_follow_up_due_at < now AND meeting_booked_at IS NULL
9. Sets: follow_up_trigger = 'no_meeting_booked'
10. Sets: follow_up_due_at = now
11. Follow-up Agent generates "Haven't had a chance to book?" message
```

### Flow 2: Prospect Sends Their Calendar Link

```
1. Prospect replies with their Calendly link
2. Reply Agent detects calendar link in message
3. Stores: prospect_calendar_link = 'https://calendly.com/john/30min'
4. Sets: conversation_stage = 'prospect_shared_calendar'

[Calendar Agent cron runs]

5. Finds prospects with conversation_stage = 'prospect_shared_calendar'
6. Checks our Google Calendar availability
7. If slots available:
   - Stores available times in metadata
   - Sets: conversation_stage = 'availability_ready'
8. Reply Agent generates response with our available times
```

### Flow 3: Meeting Cancelled

```
1. Calendly webhook: invitee.canceled
2. Calendly handler finds matching meeting and prospect
3. Updates meeting: status = 'cancelled'
4. Updates prospect:
   - conversation_stage = 'meeting_cancelled'
   - follow_up_trigger = 'meeting_cancelled'
   - calendar_follow_up_due_at = now + 24 hours
5. Follow-up Agent picks up and generates reschedule message
```

### Flow 4: No-Show

```
1. Calendly webhook: invitee_no_show
   OR Calendar Agent cron detects meeting past time with no completion

2. Updates meeting: status = 'no_show'
3. Updates prospect:
   - meeting_status = 'no_show'
   - follow_up_trigger = 'meeting_no_show'
   - calendar_follow_up_due_at = now + 2 hours
4. Follow-up Agent generates understanding "things happen" message
```

## Cron Schedules

| Cron Job | Frequency | Purpose |
|----------|-----------|---------|
| `reply-agent-process` | Every 5 min | Generate AI replies for pending drafts |
| `calendar-agent` | Every 2 hours | Check follow-up triggers, no-shows, prospect calendars |
| `generate-follow-up-drafts` | Every 15 min | Generate follow-up drafts for triggered prospects |

## Webhooks

| Endpoint | Provider | Events |
|----------|----------|--------|
| `/api/webhooks/calendly` | Calendly | invitee.created, invitee.canceled, invitee_no_show |
| `/api/webhooks/unipile/google-calendar` | Unipile | Account connection status |

## Environment Variables

```
# Calendly (for SAM users who connect Calendly)
CALENDLY_CLIENT_ID=
CALENDLY_CLIENT_SECRET=
CALENDLY_WEBHOOK_SIGNING_KEY=

# Google Calendar (for checking our availability)
# Uses Unipile's calendar API - no separate credentials needed
```

## SQL Migration

Run migration `058-agent-integration-tracking.sql` to add required columns:

```bash
# Apply migration in Supabase Dashboard SQL Editor
# Or via migration system
```

## Testing

1. **Reply Agent → Calendar Agent handoff:**
   - Send a reply containing a calendar link
   - Verify `sam_reply_included_calendar = true`
   - Wait for calendar_follow_up_due_at to pass
   - Verify Follow-up Agent is triggered

2. **Prospect calendar detection:**
   - Have prospect send a message with a Calendly link
   - Verify `prospect_calendar_link` is populated
   - Verify `conversation_stage = 'prospect_shared_calendar'`

3. **Calendly webhook:**
   - Book a meeting via Calendly
   - Verify meeting record created
   - Cancel the meeting
   - Verify Follow-up Agent triggered

## Link Tracking System

**Purpose:** Track when prospects click on links in messages to enable intelligent follow-up

### How It Works

1. **Reply Agent wraps links** - When sending a message, all URLs are replaced with tracked versions
2. **Unique links per recipient** - Each prospect gets unique short URLs for tracking
3. **Click recording** - When prospect clicks, we record the click and redirect to destination
4. **Agent triggers** - Clicks trigger conversation stage updates for follow-up

### Link Types Tracked

| Type | Examples | Agent Action on Click |
|------|----------|----------------------|
| `calendar` | Calendly, Cal.com, HubSpot Meetings | Set `calendar_clicked_pending_booking`, follow-up in 24h if no booking |
| `demo_video` | Loom, YouTube, Vimeo | Set `engaged_watching_demo` |
| `one_pager` | PDFs, DocSend | Set `engaged_researching` |
| `case_study` | Case study pages | Set `engaged_researching` |
| `trial` | Sign-up, trial pages | Set `trial_started` |
| `website` | General links | (no stage change) |

### Tracked Link Format

Original: `https://calendly.com/sam/30min`
Tracked: `https://app.meet-sam.com/t/a8k3m2p9`

### Database Tables

**tracked_links**
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `short_code` | TEXT | 8-char unique code (e.g., "a8k3m2p9") |
| `destination_url` | TEXT | Where to redirect |
| `link_type` | TEXT | calendar, demo_video, etc. |
| `prospect_id` | UUID | Which prospect this link is for |
| `campaign_id` | UUID | Associated campaign |
| `workspace_id` | UUID | Workspace owner |
| `source_type` | TEXT | reply_agent, follow_up_agent, etc. |
| `source_id` | UUID | ID of the source (reply draft ID, etc.) |

**link_clicks**
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tracked_link_id` | UUID | Which link was clicked |
| `clicked_at` | TIMESTAMPTZ | When clicked |
| `ip_address` | TEXT | For analytics |
| `user_agent` | TEXT | Browser info |
| `is_first_click` | BOOLEAN | First time this link was clicked |

**campaign_prospects (new columns)**
| Column | Type | Description |
|--------|------|-------------|
| `first_calendar_click_at` | TIMESTAMPTZ | First calendar link click |
| `first_demo_click_at` | TIMESTAMPTZ | First demo video click |
| `first_pdf_click_at` | TIMESTAMPTZ | First PDF/doc click |
| `total_link_clicks` | INTEGER | Total clicks across all links |
| `last_link_click_at` | TIMESTAMPTZ | Most recent click |

### Key Files

| File | Purpose |
|------|---------|
| `lib/services/link-tracking.ts` | Core tracking service |
| `app/t/[code]/route.ts` | Redirect endpoint |
| `sql/migrations/060-link-tracking.sql` | Database schema |

### Flow: Calendar Click Without Booking

```
1. Reply Agent sends message with calendar link
2. Link is wrapped: calendly.com/sam → app.meet-sam.com/t/abc123

[Prospect clicks link]

3. GET /t/abc123 → recordLinkClick()
4. Sets: conversation_stage = 'calendar_clicked_pending_booking'
5. Sets: calendar_follow_up_due_at = now + 24 hours
6. Redirects to calendly.com/sam

[24 hours later, no booking]

7. Calendar Agent cron (Phase 3) runs
8. Finds: conversation_stage = 'calendar_clicked_pending_booking'
         AND calendar_follow_up_due_at < now
         AND meeting_booked_at IS NULL
9. Sets: follow_up_trigger = 'calendar_clicked_no_booking'
10. Follow-up Agent generates "Saw you checked the calendar..." message
```

### SQL Migration

```bash
# Run migration 060-link-tracking.sql in Supabase Dashboard SQL Editor
```

## Notes

- Google Calendar is used for OUR availability (InnovareAI team)
- Calendly/Cal.com/etc. are options for SAM users to connect
- The Calendar Agent cron runs every 2 hours to avoid rate limits
- No-show grace period is 15 minutes after scheduled time
- Link tracking creates unique URLs per recipient for precise engagement tracking
- Links that shouldn't be tracked (LinkedIn profiles, unsubscribe, etc.) are skipped
