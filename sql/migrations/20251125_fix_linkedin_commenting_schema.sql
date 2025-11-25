-- Migration: Fix LinkedIn Commenting Agent Schema
-- Date: November 25, 2025
-- Purpose: Add missing columns and clean up duplicate RLS policies

-- ============================================
-- PART 1: Add missing columns to linkedin_post_monitors
-- ============================================

-- Add 'name' column (required by frontend)
ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add optional columns for future use
ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';

ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS daily_start_time TIME DEFAULT '09:00:00';

ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS auto_approve_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS auto_approve_start_time TIME DEFAULT '09:00:00';

ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS auto_approve_end_time TIME DEFAULT '17:00:00';

-- Add metadata column for extensibility
ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ============================================
-- PART 2: Clean up duplicate RLS policies
-- ============================================

-- Drop ALL existing policies on linkedin_post_monitors (handles duplicates)
DROP POLICY IF EXISTS "linkedin_monitors_select_workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "linkedin_monitors_insert_workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "linkedin_monitors_update_workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "linkedin_monitors_delete_workspace" ON linkedin_post_monitors;

-- Drop any duplicate policies with slightly different names
DROP POLICY IF EXISTS "linkedin_post_monitors_select_workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "linkedin_post_monitors_insert_workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "linkedin_post_monitors_update_workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "linkedin_post_monitors_delete_workspace" ON linkedin_post_monitors;

-- Drop generic named policies
DROP POLICY IF EXISTS "monitors_select" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "monitors_insert" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "monitors_update" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "monitors_delete" ON linkedin_post_monitors;

-- Drop any remaining policies using direct SQL
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'linkedin_post_monitors'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON linkedin_post_monitors', pol.policyname);
    END LOOP;
END $$;

-- ============================================
-- PART 3: Create fresh RLS policies (only 4)
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE linkedin_post_monitors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT monitors for their workspace
CREATE POLICY "monitors_workspace_select"
  ON linkedin_post_monitors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_post_monitors.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Policy: Users can INSERT monitors for their workspace
CREATE POLICY "monitors_workspace_insert"
  ON linkedin_post_monitors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_post_monitors.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Policy: Users can UPDATE monitors in their workspace
CREATE POLICY "monitors_workspace_update"
  ON linkedin_post_monitors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_post_monitors.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_post_monitors.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- Policy: Users can DELETE monitors in their workspace
CREATE POLICY "monitors_workspace_delete"
  ON linkedin_post_monitors
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_post_monitors.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- ============================================
-- PART 4: Verify changes
-- ============================================

-- This should now show exactly 4 policies
-- Run: SELECT policyname FROM pg_policies WHERE tablename = 'linkedin_post_monitors';

-- Verify columns exist
-- Run: SELECT column_name FROM information_schema.columns WHERE table_name = 'linkedin_post_monitors';
