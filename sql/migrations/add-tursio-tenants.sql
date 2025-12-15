-- Add 'alekh' and 'rony' tenants for Tursio users
-- Run this in Supabase SQL Editor

ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_tenant_check;
ALTER TABLE workspaces ADD CONSTRAINT workspaces_tenant_check
  CHECK (tenant IN ('innovareai', 'wtmatchmaker', 'truepeople', 'sendingcell', 'alekh', 'rony'));
