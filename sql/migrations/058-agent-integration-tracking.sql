-- Migration: Agent Integration Tracking Fields
-- Purpose: Enable Reply Agent → Calendar Agent → Follow-up Agent handoff
-- Date: 2025-12-20

-- ============================================
-- 1. CAMPAIGN_PROSPECTS: Track Reply Agent actions
-- ============================================

-- When SAM (Reply Agent) sent a response to prospect
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS sam_reply_sent_at TIMESTAMPTZ;

-- Did SAM's reply include a calendar link?
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS sam_reply_included_calendar BOOLEAN DEFAULT FALSE;

-- If prospect sent their calendar link, store it
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS prospect_calendar_link TEXT;

-- What triggered the Follow-up Agent?
-- Values: 'no_meeting_booked', 'meeting_cancelled', 'meeting_no_show', 'no_response', 'manual'
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS follow_up_trigger TEXT;

-- When should the follow-up agent check this prospect?
-- Set to sam_reply_sent_at + 3 days when SAM sends a reply with calendar link
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS calendar_follow_up_due_at TIMESTAMPTZ;

-- Track the conversation stage for the Follow-up Agent
-- Values: 'initial_outreach', 'awaiting_response', 'awaiting_booking', 'meeting_scheduled', 'meeting_completed', 'closed'
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS conversation_stage TEXT DEFAULT 'initial_outreach';

-- ============================================
-- 2. REPLY_AGENT_DRAFTS: Track calendar link inclusion
-- ============================================

-- Did this draft include a calendar link?
ALTER TABLE reply_agent_drafts
ADD COLUMN IF NOT EXISTS included_calendar_link BOOLEAN DEFAULT FALSE;

-- Did prospect's message contain a calendar link?
ALTER TABLE reply_agent_drafts
ADD COLUMN IF NOT EXISTS prospect_sent_calendar_link TEXT;

-- ============================================
-- 3. MEETINGS: Link back to reply agent draft
-- ============================================

-- Which reply agent draft led to this meeting booking?
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS source_reply_draft_id UUID REFERENCES reply_agent_drafts(id);

-- ============================================
-- 4. CREATE INDEX for Follow-up Agent queries
-- ============================================

-- Index for finding prospects awaiting calendar booking
CREATE INDEX IF NOT EXISTS idx_prospects_calendar_follow_up
ON campaign_prospects (calendar_follow_up_due_at)
WHERE calendar_follow_up_due_at IS NOT NULL
  AND meeting_booked_at IS NULL
  AND conversation_stage = 'awaiting_booking';

-- Index for finding prospects where SAM replied but no response
CREATE INDEX IF NOT EXISTS idx_prospects_sam_replied_no_response
ON campaign_prospects (sam_reply_sent_at)
WHERE sam_reply_sent_at IS NOT NULL
  AND responded_at IS NULL;

-- ============================================
-- 5. COMMENTS for documentation
-- ============================================

COMMENT ON COLUMN campaign_prospects.sam_reply_sent_at IS
  'Timestamp when Reply Agent (SAM) sent a response to this prospect. Used by Follow-up Agent to calculate follow-up timing.';

COMMENT ON COLUMN campaign_prospects.sam_reply_included_calendar IS
  'Whether SAM''s reply included a calendar booking link. If true, Calendar Agent monitors for booking.';

COMMENT ON COLUMN campaign_prospects.prospect_calendar_link IS
  'Calendar link sent BY the prospect (e.g., Calendly, Cal.com). System should check OUR availability and respond.';

COMMENT ON COLUMN campaign_prospects.follow_up_trigger IS
  'What triggered the Follow-up Agent for this prospect: no_meeting_booked, meeting_cancelled, meeting_no_show, no_response, manual';

COMMENT ON COLUMN campaign_prospects.calendar_follow_up_due_at IS
  'When Follow-up Agent should check if meeting was booked. Typically set to sam_reply_sent_at + 3 days.';

COMMENT ON COLUMN campaign_prospects.conversation_stage IS
  'Current stage: initial_outreach, awaiting_response, awaiting_booking, meeting_scheduled, meeting_completed, closed';

COMMENT ON COLUMN reply_agent_drafts.included_calendar_link IS
  'Whether this draft included a calendar booking link';

COMMENT ON COLUMN reply_agent_drafts.prospect_sent_calendar_link IS
  'If prospect sent their own calendar link in their message, store it here';

COMMENT ON COLUMN meetings.source_reply_draft_id IS
  'Links meeting back to the reply agent draft that led to booking';
