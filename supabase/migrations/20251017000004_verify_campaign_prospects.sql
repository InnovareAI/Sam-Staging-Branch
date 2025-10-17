-- Verify campaign_prospects table structure and fix any issues
-- Ensure it properly references campaigns table

-- Ensure campaign_prospects has all necessary columns
DO $$
BEGIN
    -- Add workspace_id if missing (for RLS and analytics)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaign_prospects' AND column_name = 'workspace_id'
    ) THEN
        ALTER TABLE campaign_prospects ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

        -- Populate workspace_id from campaigns table
        UPDATE campaign_prospects cp
        SET workspace_id = c.workspace_id
        FROM campaigns c
        WHERE cp.campaign_id = c.id;
    END IF;

    -- Add source column if missing (to track where prospect came from)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaign_prospects' AND column_name = 'source'
    ) THEN
        ALTER TABLE campaign_prospects ADD COLUMN source TEXT DEFAULT 'manual';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_campaign_id ON campaign_prospects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_workspace_id ON campaign_prospects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_status ON campaign_prospects(status);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_linkedin_user_id ON campaign_prospects(linkedin_user_id) WHERE linkedin_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_email ON campaign_prospects(email) WHERE email IS NOT NULL;

-- Enable RLS if not already enabled
ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;

-- Drop old RLS policies and create new ones with Supabase auth
DROP POLICY IF EXISTS "Enable all operations for service role" ON campaign_prospects;
DROP POLICY IF EXISTS "Users can access workspace campaign prospects" ON campaign_prospects;

-- Create comprehensive RLS policy for campaign_prospects
CREATE POLICY "Users can access workspace campaign prospects" ON campaign_prospects
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

COMMENT ON TABLE campaign_prospects IS 'Prospects associated with campaigns, includes workspace_id for RLS';
COMMENT ON COLUMN campaign_prospects.workspace_id IS 'Denormalized from campaigns for faster RLS queries';
