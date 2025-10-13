-- Migration: Add reseller affiliation field
-- Created: 2025-10-13
-- Purpose: Track how the workspace was created (signup method)
-- Business Rules:
--   - '3cubed' = Created via invite-only super admin dashboard
--   - 'innovareai' = Self-service Stripe signup
--   - 'direct' = Reserved for future use

-- 1. Add reseller_affiliation column
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS reseller_affiliation TEXT
CHECK (reseller_affiliation IN ('3cubed', 'innovareai', 'direct'));

-- 2. Create index for reseller queries
CREATE INDEX IF NOT EXISTS idx_workspaces_reseller_affiliation
ON workspaces(reseller_affiliation);

-- 3. Set reseller affiliations for 3cubed partner workspaces
UPDATE workspaces
SET reseller_affiliation = '3cubed'
WHERE tenant IN ('sendingcell', 'truepeople', 'wtmatchmaker', '3cubed');

-- 4. Set reseller affiliations for InnovareAI direct workspaces
UPDATE workspaces
SET reseller_affiliation = 'innovareai'
WHERE tenant IN ('innovareai', 'bluelabel');

-- 5. Add documentation
COMMENT ON COLUMN workspaces.reseller_affiliation IS 'Signup method: 3cubed (invite-only super admin), innovareai (Stripe self-service), direct (reserved)';
