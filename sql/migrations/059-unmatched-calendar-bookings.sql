-- Migration: Unmatched Calendar Bookings Table
-- Purpose: Store calendar booking webhooks that don't match existing prospects
-- Date: 2025-12-20

-- ============================================
-- 1. UNMATCHED CALENDAR BOOKINGS
-- ============================================

CREATE TABLE IF NOT EXISTS unmatched_calendar_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Booking info
  email TEXT NOT NULL,
  name TEXT,
  platform TEXT NOT NULL,  -- 'calendly', 'cal.com', 'hubspot', etc.
  event_uri TEXT,
  scheduled_at TIMESTAMPTZ,

  -- Raw data for later processing
  raw_payload JSONB,

  -- Matching status
  matched_at TIMESTAMPTZ,
  matched_prospect_id UUID REFERENCES campaign_prospects(id),
  matched_by TEXT,  -- 'auto' or user_id

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding unmatched bookings
CREATE INDEX IF NOT EXISTS idx_unmatched_bookings_email
ON unmatched_calendar_bookings(email)
WHERE matched_at IS NULL;

-- Index for finding by platform/event
CREATE INDEX IF NOT EXISTS idx_unmatched_bookings_platform
ON unmatched_calendar_bookings(platform, event_uri);

-- RLS
ALTER TABLE unmatched_calendar_bookings ENABLE ROW LEVEL SECURITY;

-- Service role can manage all
CREATE POLICY unmatched_bookings_service_role ON unmatched_calendar_bookings
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE unmatched_calendar_bookings IS 'Stores calendar booking webhooks that could not be matched to existing prospects';
