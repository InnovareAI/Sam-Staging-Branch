-- ========================================
-- COMPLETE WORKSPACE ISOLATION MIGRATION
-- ========================================

-- Disable trigger (ignore if doesn't exist)
DO $$
BEGIN
  EXECUTE 'ALTER TABLE workspaces DISABLE TRIGGER auto_assign_client_code_trigger';
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- ========================================
-- PART 1: SPLIT INNOVAREAI INTO IA1-IA6
-- ========================================

-- 1. Rename original workspace to IA1 (Thorsten)
UPDATE workspaces
SET name = 'IA1', client_code = 'IA1', slug = 'ia1', owner_id = 'f6885ff3-deef-4781-8721-93011c990b1b'
WHERE id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

-- 2. Create IA2 (Michelle)
INSERT INTO workspaces (id, name, client_code, slug, owner_id, created_at, updated_at)
VALUES ('04666209-fce8-4d71-8eaf-01278edfc73b', 'IA2', 'IA2', 'ia2', '471bcb15-cc53-44f3-b5d2-4b97bb7a8b2f', NOW(), NOW());

-- 3. Create IA3 (Irish)
INSERT INTO workspaces (id, name, client_code, slug, owner_id, created_at, updated_at)
VALUES ('96c03b38-a2f4-40de-9e16-43098599e1d4', 'IA3', 'IA3', 'ia3', '1949f7fc-f354-47ba-98f1-ae0a7d3b1d5d', NOW(), NOW());

-- 4. Create IA4 (Charissa)
INSERT INTO workspaces (id, name, client_code, slug, owner_id, created_at, updated_at)
VALUES ('7f0341da-88db-476b-ae0a-fc0da5b70861', 'IA4', 'IA4', 'ia4', '744649a8-d015-4ff7-9e41-983cc9ca7b79', NOW(), NOW());

-- 5. Create IA5 (Jennifer)
INSERT INTO workspaces (id, name, client_code, slug, owner_id, created_at, updated_at)
VALUES ('cd57981a-e63b-401c-bde1-ac71752c2293', 'IA5', 'IA5', 'ia5', 'a4c3ff4d-ac9c-4e84-9b35-967ce6ff8189', NOW(), NOW());

-- 6. Create IA6 (Chona)
INSERT INTO workspaces (id, name, client_code, slug, owner_id, created_at, updated_at)
VALUES ('2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', 'IA6', 'IA6', 'ia6', 'dbbddc37-8740-4614-b448-53e0bfff2290', NOW(), NOW());

-- Remove all members except Thorsten from IA1
DELETE FROM workspace_members
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND user_id != 'f6885ff3-deef-4781-8721-93011c990b1b';

UPDATE workspace_members
SET role = 'owner'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  AND user_id = 'f6885ff3-deef-4781-8721-93011c990b1b';

-- Add owners to new workspaces
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at) VALUES
('04666209-fce8-4d71-8eaf-01278edfc73b', '471bcb15-cc53-44f3-b5d2-4b97bb7a8b2f', 'owner', 'active', NOW()),
('96c03b38-a2f4-40de-9e16-43098599e1d4', '1949f7fc-f354-47ba-98f1-ae0a7d3b1d5d', 'owner', 'active', NOW()),
('7f0341da-88db-476b-ae0a-fc0da5b70861', '744649a8-d015-4ff7-9e41-983cc9ca7b79', 'owner', 'active', NOW()),
('cd57981a-e63b-401c-bde1-ac71752c2293', 'a4c3ff4d-ac9c-4e84-9b35-967ce6ff8189', 'owner', 'active', NOW()),
('2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', 'dbbddc37-8740-4614-b448-53e0bfff2290', 'owner', 'active', NOW());

-- Add service accounts
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at) VALUES
('babdcab8-1a78-4b2f-913e-6e9fd9821009', 'f1cf9d61-3606-4f80-a8c1-c89565d1d494', 'admin', 'active', NOW()),
('04666209-fce8-4d71-8eaf-01278edfc73b', '1ba2b9ed-b7fe-4f6d-b001-0370860a42e8', 'admin', 'active', NOW()),
('96c03b38-a2f4-40de-9e16-43098599e1d4', '83935b70-8067-4b2f-9206-3cad5ce8746b', 'admin', 'active', NOW()),
('7f0341da-88db-476b-ae0a-fc0da5b70861', 'fc489c4b-828d-4d82-833b-785ba876f168', 'admin', 'active', NOW()),
('cd57981a-e63b-401c-bde1-ac71752c2293', 'bd9052de-392f-46f0-b7e9-60ac8f70af0c', 'admin', 'active', NOW()),
('2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', '4d48e667-86ed-4eb1-8b60-3c342d55b73d', 'admin', 'active', NOW());

-- Move LinkedIn accounts
UPDATE workspace_accounts SET workspace_id = '04666209-fce8-4d71-8eaf-01278edfc73b'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009' AND unipile_account_id = 'MT39bAEDTJ6e_ZPY337UgQ';

UPDATE workspace_accounts SET workspace_id = '96c03b38-a2f4-40de-9e16-43098599e1d4'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009' AND unipile_account_id = 'avp6xHsCRZaP5uSPmjc2jg';

UPDATE workspace_accounts SET workspace_id = '7f0341da-88db-476b-ae0a-fc0da5b70861'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009' AND unipile_account_id = '4nt1J-blSnGUPBjH2Nfjpg';

-- Move campaigns
UPDATE campaigns SET workspace_id = '04666209-fce8-4d71-8eaf-01278edfc73b'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009' AND created_by = '471bcb15-cc53-44f3-b5d2-4b97bb7a8b2f';

UPDATE campaigns SET workspace_id = '96c03b38-a2f4-40de-9e16-43098599e1d4'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009' AND created_by = '1949f7fc-f354-47ba-98f1-ae0a7d3b1d5d';

UPDATE campaigns SET workspace_id = '7f0341da-88db-476b-ae0a-fc0da5b70861'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009' AND created_by = '744649a8-d015-4ff7-9e41-983cc9ca7b79';

-- Move campaign prospects (follows campaigns)
UPDATE campaign_prospects cp SET workspace_id = '04666209-fce8-4d71-8eaf-01278edfc73b'
FROM campaigns c WHERE cp.campaign_id = c.id AND c.created_by = '471bcb15-cc53-44f3-b5d2-4b97bb7a8b2f';

UPDATE campaign_prospects cp SET workspace_id = '96c03b38-a2f4-40de-9e16-43098599e1d4'
FROM campaigns c WHERE cp.campaign_id = c.id AND c.created_by = '1949f7fc-f354-47ba-98f1-ae0a7d3b1d5d';

UPDATE campaign_prospects cp SET workspace_id = '7f0341da-88db-476b-ae0a-fc0da5b70861'
FROM campaigns c WHERE cp.campaign_id = c.id AND c.created_by = '744649a8-d015-4ff7-9e41-983cc9ca7b79';

-- NOTE: workspace_prospects and prospect_approval_data don't have created_by column
-- They will remain in IA1 (original workspace) for now
-- Can be manually reassigned later if needed

-- ========================================
-- PART 2: SPLIT SENDINGCELL
-- ========================================

INSERT INTO workspaces (id, name, client_code, slug, owner_id, created_at, updated_at)
VALUES ('cf27fd56-2350-4bef-9c0b-9508463a1646', 'SC1', 'SC1', 'sc1', '7ca2fb4e-469e-464f-84b6-62171dd90eaf', NOW(), NOW());

UPDATE workspaces SET name = 'SC2', client_code = 'SC2', slug = 'sc2', owner_id = 'c9be4bd2-a560-4707-9d05-74a32d41ca18'
WHERE id = 'b070d94f-11e2-41d4-a913-cc5a8c017208';

DELETE FROM workspace_members
WHERE workspace_id = 'b070d94f-11e2-41d4-a913-cc5a8c017208' AND user_id = '7ca2fb4e-469e-464f-84b6-62171dd90eaf';

INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('cf27fd56-2350-4bef-9c0b-9508463a1646', '7ca2fb4e-469e-464f-84b6-62171dd90eaf', 'owner', 'active', NOW());

UPDATE workspace_members SET role = 'owner'
WHERE workspace_id = 'b070d94f-11e2-41d4-a913-cc5a8c017208' AND user_id = 'c9be4bd2-a560-4707-9d05-74a32d41ca18';

UPDATE workspace_accounts SET workspace_id = 'cf27fd56-2350-4bef-9c0b-9508463a1646'
WHERE workspace_id = 'b070d94f-11e2-41d4-a913-cc5a8c017208' AND unipile_account_id = 'J6pyDIoQSfmGDEIbwXBy3A';

INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('cf27fd56-2350-4bef-9c0b-9508463a1646', 'def9309e-c631-456b-a0aa-99f9be253952', 'admin', 'active', NOW());

-- Re-enable trigger
DO $$
BEGIN
  EXECUTE 'ALTER TABLE workspaces ENABLE TRIGGER auto_assign_client_code_trigger';
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- ========================================
-- DONE! All workspaces isolated!
-- ========================================
