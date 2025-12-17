-- Migration: Add timezone column to workspaces table
-- Created: December 17, 2025
-- Purpose: Allow workspaces to have a default timezone that new campaigns inherit

-- Add timezone column to workspaces
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles';

-- Add comment
COMMENT ON COLUMN workspaces.timezone IS 'Default timezone for this workspace. New campaigns inherit this timezone. Examples: America/Los_Angeles, Europe/Berlin, Asia/Tokyo';

-- Set timezone for known workspaces
-- Sebastian Henkel (formerly Asphericon) -> Berlin
UPDATE workspaces SET timezone = 'Europe/Berlin' WHERE id = 'c3100bea-82a6-4365-b159-6581f1be9be3';

-- InnovareAI workspaces -> Los Angeles (default)
UPDATE workspaces SET timezone = 'America/Los_Angeles' WHERE timezone IS NULL;

-- Create index for timezone queries
CREATE INDEX IF NOT EXISTS idx_workspaces_timezone ON workspaces(timezone);
