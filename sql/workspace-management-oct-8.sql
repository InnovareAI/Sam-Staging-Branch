-- Workspace Management Tasks - October 8, 2025
-- Run these in Supabase SQL editor

-- TASK 1: Delete ChillMine workspace
-- This will cascade delete all related data due to foreign key constraints

-- First, check if the workspace exists and get its ID
SELECT id, name, owner_id, created_at FROM workspaces WHERE name ILIKE '%ChillMine%';

-- Delete the workspace (cascades to workspace_members, etc.)
-- Replace the WHERE clause with the actual ID from the query above if needed
DELETE FROM workspaces
WHERE name ILIKE '%ChillMine%';

-- TASK 2: Change ownership of True People Consulting workspace to tl@3cubed.ai

-- Step 1: Find the workspace and current owner
SELECT id, name, owner_id FROM workspaces WHERE name ILIKE '%True People%';

-- Step 2: Find the new owner's user_id
SELECT id, email FROM auth.users WHERE email = 'tl@3cubed.ai';

-- Step 3: Update workspace ownership
UPDATE workspaces
SET owner_id = (SELECT id FROM auth.users WHERE email = 'tl@3cubed.ai')
WHERE name ILIKE '%True People%';

-- Step 4: Ensure tl@3cubed.ai is a member of the workspace with owner role
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT
  w.id,
  (SELECT id FROM auth.users WHERE email = 'tl@3cubed.ai'),
  'owner'
FROM workspaces w
WHERE w.name ILIKE '%True People%'
ON CONFLICT (workspace_id, user_id) DO UPDATE
SET role = 'owner';

-- Verification queries:
SELECT 'ChillMine deleted (should be 0):' as status, COUNT(*) as count
FROM workspaces
WHERE name ILIKE '%ChillMine%';

SELECT 'True People Consulting owner:' as status,
  w.name,
  w.owner_id,
  u.email as owner_email
FROM workspaces w
LEFT JOIN auth.users u ON w.owner_id = u.id
WHERE w.name ILIKE '%True People%';
