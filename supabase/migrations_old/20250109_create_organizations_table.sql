-- Create organizations table for Clerk organization sync
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_org_id TEXT UNIQUE NOT NULL, -- Clerk organization ID
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL, -- Clerk user ID of creator
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_organizations_clerk_org_id ON organizations(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- RLS policies for organizations
-- Users can see organizations they're members of
CREATE POLICY "Users can view organizations they belong to" ON organizations
  FOR SELECT USING (
    clerk_org_id IN (
      SELECT jsonb_array_elements_text(
        auth.jwt() -> 'organizations'
      )
    )
  );

-- Only org admins can update organization settings
CREATE POLICY "Organization admins can update organizations" ON organizations
  FOR UPDATE USING (
    clerk_org_id IN (
      SELECT jsonb_array_elements_text(
        auth.jwt() -> 'organizations'
      )
    ) AND
    (auth.jwt() ->> 'org_role') IN ('org:admin')
  );

-- Organization creators can insert (for webhook sync)
CREATE POLICY "Service role can manage organizations" ON organizations
  FOR ALL USING (auth.role() = 'service_role');

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE organizations IS 'Organizations synced from Clerk for multi-tenant isolation';
COMMENT ON COLUMN organizations.clerk_org_id IS 'Clerk organization ID for sync';
COMMENT ON COLUMN organizations.settings IS 'Organization configuration and preferences';