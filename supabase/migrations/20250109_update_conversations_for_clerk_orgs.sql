-- Update sam_conversations table to use Clerk organizations instead of workspaces
ALTER TABLE sam_conversations 
ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- Create index for fast organization-based queries
CREATE INDEX IF NOT EXISTS idx_sam_conversations_organization_id ON sam_conversations(organization_id);

-- Update RLS policies to use organization_id
DROP POLICY IF EXISTS "Users can view their own conversations" ON sam_conversations;
DROP POLICY IF EXISTS "Users can create their own conversations" ON sam_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON sam_conversations;

-- New RLS policies based on organization membership
CREATE POLICY "Users can view conversations in their organization" ON sam_conversations
  FOR SELECT USING (
    organization_id IN (
      SELECT jsonb_array_elements_text(
        auth.jwt() -> 'organizations'
      )
    ) OR 
    user_id = auth.uid()::text -- Users can always see their own conversations
  );

CREATE POLICY "Users can create conversations in their organization" ON sam_conversations
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::text AND
    (organization_id IS NULL OR organization_id IN (
      SELECT jsonb_array_elements_text(
        auth.jwt() -> 'organizations'
      )
    ))
  );

CREATE POLICY "Users can update conversations in their organization" ON sam_conversations
  FOR UPDATE USING (
    user_id = auth.uid()::text AND
    (organization_id IS NULL OR organization_id IN (
      SELECT jsonb_array_elements_text(
        auth.jwt() -> 'organizations'
      )
    ))
  );

-- Service role can manage all conversations (for API operations)
CREATE POLICY "Service role can manage all conversations" ON sam_conversations
  FOR ALL USING (auth.role() = 'service_role');

-- Comments
COMMENT ON COLUMN sam_conversations.organization_id IS 'Clerk organization ID for multi-tenant isolation';