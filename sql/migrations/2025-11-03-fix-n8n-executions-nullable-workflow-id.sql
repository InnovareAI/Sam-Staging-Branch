-- Make workspace_n8n_workflow_id nullable in n8n_campaign_executions
-- This field is optional and not all campaigns have an associated workspace workflow

ALTER TABLE n8n_campaign_executions
ALTER COLUMN workspace_n8n_workflow_id DROP NOT NULL;

-- Verify the change
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'n8n_campaign_executions'
  AND column_name = 'workspace_n8n_workflow_id';
