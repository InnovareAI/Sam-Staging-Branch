-- Add commenting_agent_enabled column to workspaces table
-- This is required for the LinkedIn Commenting Agent feature

-- Add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspaces'
    AND column_name = 'commenting_agent_enabled'
  ) THEN
    ALTER TABLE workspaces
    ADD COLUMN commenting_agent_enabled BOOLEAN DEFAULT FALSE;

    -- Create index for quick feature check
    CREATE INDEX idx_workspaces_commenting_enabled
    ON workspaces(commenting_agent_enabled)
    WHERE commenting_agent_enabled = TRUE;

    RAISE NOTICE 'Added commenting_agent_enabled column to workspaces table';
  ELSE
    RAISE NOTICE 'Column commenting_agent_enabled already exists';
  END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'workspaces'
  AND column_name = 'commenting_agent_enabled';
