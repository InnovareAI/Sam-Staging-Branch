-- Migration: Expand tenant constraints to support all workspace email domains
-- Created: 2025-10-13
-- Purpose: Allow tenant field to accept all user email domains
-- Business Rules:
--   1. tenant = email domain (e.g., 'sendingcell' for @sendingcell.com)
--   2. Workspace naming:
--      - Corporate email (@company.com) → Workspace name = "Company"
--      - Public email (@gmail.com, @icloud.com) → Workspace name = "FirstName LastName"

-- 1. Drop existing constraint
ALTER TABLE workspaces
DROP CONSTRAINT IF EXISTS workspaces_tenant_check;

-- 2. Add new constraint with expanded tenant list
ALTER TABLE workspaces
ADD CONSTRAINT workspaces_tenant_check CHECK (
  tenant IN ('innovareai', '3cubed', 'sendingcell', 'truepeople', 'wtmatchmaker', 'bluelabel')
);

-- 3. Update Sendingcell Workspace tenant
UPDATE workspaces
SET tenant = 'sendingcell'
WHERE name = 'Sendingcell Workspace';

-- 4. Update True People Consulting tenant
UPDATE workspaces
SET tenant = 'truepeople'
WHERE name = 'True People Consulting';

-- 5. Update WT Matchmaker Workspace tenant
UPDATE workspaces
SET tenant = 'wtmatchmaker'
WHERE name = 'WT Matchmaker Workspace';

-- 6. Update Blue Label Labs tenant
UPDATE workspaces
SET tenant = 'bluelabel'
WHERE name = 'Blue Label Labs';

-- 7. Update comments
COMMENT ON COLUMN workspaces.tenant IS 'Tenant identifier: innovareai (InnovareAI), 3cubed (3cubed), sendingcell (Sendingcell), truepeople (True People Consulting), wtmatchmaker (WT Matchmaker), bluelabel (Blue Label Labs)';
