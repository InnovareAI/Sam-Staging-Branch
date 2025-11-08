-- ========================================
-- COMPLETE WORKSPACE ISOLATION MIGRATION
-- ========================================
-- This script splits all shared workspaces into isolated workspaces
-- Each workspace will have ONLY ONE owner with their accounts
-- ========================================

-- ========================================
-- PART 1: SPLIT INNOVAREAI INTO IA1-IA5
-- ========================================

-- 1. Rename original workspace to IA1 (Thorsten)
UPDATE workspaces
SET name = 'IA1'
WHERE id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

-- 2. Create IA2 (Michelle)
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('04666209-fce8-4d71-8eaf-01278edfc73b', 'IA2', NOW(), NOW());

-- 3. Create IA3 (Irish)
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('96c03b38-a2f4-40de-9e16-43098599e1d4', 'IA3', NOW(), NOW());

-- 4. Create IA4 (Charissa)
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('7f0341da-88db-476b-ae0a-fc0da5b70861', 'IA4', NOW(), NOW());

-- 5. Create IA5 (Jennifer)
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('cd57981a-e63b-401c-bde1-ac71752c2293', 'IA5', NOW(), NOW());

-- 6. Create IA6 (Chona)
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', 'IA6', NOW(), NOW());

-- ========================================
-- REMOVE ALL MEMBERS EXCEPT THORSTEN FROM IA1
-- ========================================

DELETE FROM workspace_members
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND user_id != 'f6885ff3-deef-4781-8721-93011c990b1b';

-- Ensure Thorsten is owner in IA1
UPDATE workspace_members
SET role = 'owner'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND user_id = 'f6885ff3-deef-4781-8721-93011c990b1b';

-- ========================================
-- ADD OWNERS TO NEW WORKSPACES (ONE OWNER EACH)
-- ========================================

-- Add Michelle as owner in IA2
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('04666209-fce8-4d71-8eaf-01278edfc73b', '471bcb15-cc53-44f3-b5d2-4b97bb7a8b2f', 'owner', 'active', NOW());

-- Add Irish as owner in IA3
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('96c03b38-a2f4-40de-9e16-43098599e1d4', '1949f7fc-f354-47ba-98f1-ae0a7d3b1d5d', 'owner', 'active', NOW());

-- Add Charissa as owner in IA4
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('7f0341da-88db-476b-ae0a-fc0da5b70861', '744649a8-d015-4ff7-9e41-983cc9ca7b79', 'owner', 'active', NOW());

-- Add Jennifer as owner in IA5
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('cd57981a-e63b-401c-bde1-ac71752c2293', 'a4c3ff4d-ac9c-4e84-9b35-967ce6ff8189', 'owner', 'active', NOW());

-- Add Chona as owner in IA6
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', 'dbbddc37-8740-4614-b448-53e0bfff2290', 'owner', 'active', NOW());

-- ========================================
-- ADD SERVICE ACCOUNTS TO EACH WORKSPACE
-- ========================================

-- Add admin1 to IA1
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'f1cf9d61-3606-4f80-a8c1-c89565d1d494', 'admin', 'active', NOW());

-- Add admin2 to IA2
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('04666209-fce8-4d71-8eaf-01278edfc73b', '1ba2b9ed-b7fe-4f6d-b001-0370860a42e8', 'admin', 'active', NOW());

-- Add admin3 to IA3
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('96c03b38-a2f4-40de-9e16-43098599e1d4', '83935b70-8067-4b2f-9206-3cad5ce8746b', 'admin', 'active', NOW());

-- Add admin4 to IA4
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('7f0341da-88db-476b-ae0a-fc0da5b70861', 'fc489c4b-828d-4d82-833b-785ba876f168', 'admin', 'active', NOW());

-- Add admin5 to IA5
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('cd57981a-e63b-401c-bde1-ac71752c2293', 'bd9052de-392f-46f0-b7e9-60ac8f70af0c', 'admin', 'active', NOW());

-- Add admin6 to IA6
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', '4d48e667-86ed-4eb1-8b60-3c342d55b73d', 'admin', 'active', NOW());

-- ========================================
-- MOVE LINKEDIN ACCOUNTS TO RESPECTIVE WORKSPACES
-- ========================================

-- Move Michelle's LinkedIn account to IA2
UPDATE workspace_accounts
SET workspace_id = '04666209-fce8-4d71-8eaf-01278edfc73b'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND unipile_account_id = 'MT39bAEDTJ6e_ZPY337UgQ';

-- Move Irish's LinkedIn account to IA3
UPDATE workspace_accounts
SET workspace_id = '96c03b38-a2f4-40de-9e16-43098599e1d4'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND unipile_account_id = 'avp6xHsCRZaP5uSPmjc2jg';

-- Move Charissa's LinkedIn account to IA4
UPDATE workspace_accounts
SET workspace_id = '7f0341da-88db-476b-ae0a-fc0da5b70861'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND unipile_account_id = '4nt1J-blSnGUPBjH2Nfjpg';

-- Thorsten's LinkedIn account remains in IA1
-- Jennifer has no LinkedIn accounts
-- Chona has no LinkedIn accounts

-- ========================================
-- MOVE CAMPAIGNS TO RESPECTIVE WORKSPACES
-- ========================================

-- Move Michelle's campaigns to IA2
UPDATE campaigns
SET workspace_id = '04666209-fce8-4d71-8eaf-01278edfc73b'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND created_by = '471bcb15-cc53-44f3-b5d2-4b97bb7a8b2f';

-- Move Irish's campaigns to IA3
UPDATE campaigns
SET workspace_id = '96c03b38-a2f4-40de-9e16-43098599e1d4'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND created_by = '1949f7fc-f354-47ba-98f1-ae0a7d3b1d5d';

-- Move Charissa's campaigns to IA4
UPDATE campaigns
SET workspace_id = '7f0341da-88db-476b-ae0a-fc0da5b70861'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND created_by = '744649a8-d015-4ff7-9e41-983cc9ca7b79';

-- Thorsten's campaigns remain in IA1
-- Jennifer has no campaigns
-- Chona has no campaigns

-- ========================================
-- MOVE CAMPAIGN PROSPECTS
-- ========================================

-- Move Michelle's prospects to IA2
UPDATE campaign_prospects cp
SET workspace_id = '04666209-fce8-4d71-8eaf-01278edfc73b'
FROM campaigns c
WHERE cp.campaign_id = c.id
  AND c.created_by = '471bcb15-cc53-44f3-b5d2-4b97bb7a8b2f';

-- Move Irish's prospects to IA3
UPDATE campaign_prospects cp
SET workspace_id = '96c03b38-a2f4-40de-9e16-43098599e1d4'
FROM campaigns c
WHERE cp.campaign_id = c.id
  AND c.created_by = '1949f7fc-f354-47ba-98f1-ae0a7d3b1d5d';

-- Move Charissa's prospects to IA4
UPDATE campaign_prospects cp
SET workspace_id = '7f0341da-88db-476b-ae0a-fc0da5b70861'
FROM campaigns c
WHERE cp.campaign_id = c.id
  AND c.created_by = '744649a8-d015-4ff7-9e41-983cc9ca7b79';

-- ========================================
-- MOVE OTHER DATA
-- ========================================

-- Move workspace_prospects
UPDATE workspace_prospects
SET workspace_id = '04666209-fce8-4d71-8eaf-01278edfc73b'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND created_by = '471bcb15-cc53-44f3-b5d2-4b97bb7a8b2f';

UPDATE workspace_prospects
SET workspace_id = '96c03b38-a2f4-40de-9e16-43098599e1d4'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND created_by = '1949f7fc-f354-47ba-98f1-ae0a7d3b1d5d';

UPDATE workspace_prospects
SET workspace_id = '7f0341da-88db-476b-ae0a-fc0da5b70861'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND created_by = '744649a8-d015-4ff7-9e41-983cc9ca7b79';

-- Move prospect_approval_data
UPDATE prospect_approval_data
SET workspace_id = '04666209-fce8-4d71-8eaf-01278edfc73b'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND created_by = '471bcb15-cc53-44f3-b5d2-4b97bb7a8b2f';

UPDATE prospect_approval_data
SET workspace_id = '96c03b38-a2f4-40de-9e16-43098599e1d4'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND created_by = '1949f7fc-f354-47ba-98f1-ae0a7d3b1d5d';

UPDATE prospect_approval_data
SET workspace_id = '7f0341da-88db-476b-ae0a-fc0da5b70861'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND created_by = '744649a8-d015-4ff7-9e41-983cc9ca7b79';

-- ========================================
-- PART 2: SPLIT SENDINGCELL INTO SC1-SC2
-- ========================================

-- Create SC1 for Jim Heim
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('cf27fd56-2350-4bef-9c0b-9508463a1646', 'SC1', NOW(), NOW());

-- Rename original Sendingcell to SC2 for Dave
UPDATE workspaces
SET name = 'SC2'
WHERE id = 'b070d94f-11e2-41d4-a913-cc5a8c017208';

-- Move Jim to SC1 as owner
DELETE FROM workspace_members
WHERE workspace_id = 'b070d94f-11e2-41d4-a913-cc5a8c017208'
  AND user_id = '7ca2fb4e-469e-464f-84b6-62171dd90eaf';

INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('cf27fd56-2350-4bef-9c0b-9508463a1646', '7ca2fb4e-469e-464f-84b6-62171dd90eaf', 'owner', 'active', NOW());

-- Update Dave to owner in SC2
UPDATE workspace_members
SET role = 'owner'
WHERE workspace_id = 'b070d94f-11e2-41d4-a913-cc5a8c017208'
  AND user_id = 'c9be4bd2-a560-4707-9d05-74a32d41ca18';

-- Move Jim's LinkedIn account to SC1
UPDATE workspace_accounts
SET workspace_id = 'cf27fd56-2350-4bef-9c0b-9508463a1646'
WHERE workspace_id = 'b070d94f-11e2-41d4-a913-cc5a8c017208'
  AND unipile_account_id = 'J6pyDIoQSfmGDEIbwXBy3A';

-- Add Cathy to SC1 as admin
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('cf27fd56-2350-4bef-9c0b-9508463a1646', 'def9309e-c631-456b-a0aa-99f9be253952', 'admin', 'active', NOW());

-- Cathy remains in SC2 as admin (already there)

-- ========================================
-- DONE! SUMMARY OF WORKSPACES:
-- ========================================
-- IA1 → Thorsten (tl@innovareai.com) + admin1@innovareai.com
-- IA2 → Michelle (mg@innovareai.com) + admin2@innovareai.com
-- IA3 → Irish (im@innovareai.com) + admin3@innovareai.com
-- IA4 → Charissa (cs@innovareai.com) + admin4@innovareai.com
-- IA5 → Jennifer (jf@innovareai.com) + admin5@innovareai.com
-- IA6 → Chona (cl@innovareai.com) + admin6@innovareai.com
-- SC1 → Jim Heim + Cathy (service account)
-- SC2 → Dave Stuteville + Cathy (service account)
--
-- SERVICE ACCOUNT PASSWORDS (CHANGE AFTER FIRST LOGIN):
-- admin1@innovareai.com: Admin1InnovareAI2025!
-- admin2@innovareai.com: Admin2InnovareAI2025!
-- admin3@innovareai.com: Admin3InnovareAI2025!
-- admin4@innovareai.com: Admin4InnovareAI2025!
-- admin5@innovareai.com: Admin5InnovareAI2025!
-- admin6@innovareai.com: Admin6InnovareAI2025!
--
-- All workspaces are now isolated!
-- ========================================
