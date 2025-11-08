const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function splitInnovare() {
  console.log('🔄 Splitting InnovareAI workspace...\n');

  const originalWorkspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  // Generate new workspace IDs
  const michelleWsId = crypto.randomUUID();
  const irishWsId = crypto.randomUUID();
  const charissaWsId = crypto.randomUUID();

  // Get all users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  const tl = users.find(u => u.email === 'tl@innovareai.com');
  const mg = users.find(u => u.email === 'mg@innovareai.com');
  const im = users.find(u => u.email === 'im@innovareai.com');
  const cs = users.find(u => u.email === 'cs@innovareai.com');
  const jf = users.find(u => u.email === 'jf@innovareai.com');
  const cl = users.find(u => u.email === 'cl@innovareai.com');

  console.log('👥 User IDs:');
  console.log(`  tl@innovareai.com: ${tl?.id}`);
  console.log(`  mg@innovareai.com: ${mg?.id}`);
  console.log(`  im@innovareai.com: ${im?.id}`);
  console.log(`  cs@innovareai.com: ${cs?.id}`);
  console.log(`  jf@innovareai.com: ${jf?.id}`);
  console.log(`  cl@innovareai.com: ${cl?.id}\n`);

  console.log('📋 New Workspace IDs:');
  console.log(`  Michelle workspace: ${michelleWsId}`);
  console.log(`  Irish workspace: ${irishWsId}`);
  console.log(`  Charissa workspace: ${charissaWsId}\n`);

  console.log('📁 SQL to execute in Supabase dashboard:\n');
  console.log('═══════════════════════════════════════════════════\n');

  const sql = `
-- ========================================
-- SPLIT INNOVAREAI WORKSPACE
-- ========================================

-- 1. Keep InnovareAI for Thorsten (tl@innovareai.com)
UPDATE workspaces
SET name = 'InnovareAI'
WHERE id = '${originalWorkspaceId}';

-- 2. Create Michelle's workspace
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('${michelleWsId}', 'IAI-Michelle', NOW(), NOW());

-- 3. Create Irish's workspace
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('${irishWsId}', 'IAI-Irish', NOW(), NOW());

-- 4. Create Charissa's workspace
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('${charissaWsId}', 'IAI-Charissa', NOW(), NOW());

-- ========================================
-- MOVE MEMBERS
-- ========================================

-- Remove Michelle, Irish, and Charissa from InnovareAI
DELETE FROM workspace_members
WHERE workspace_id = '${originalWorkspaceId}'
  AND user_id IN ('${mg?.id}', '${im?.id}', '${cs?.id}');

-- Add Michelle to her workspace as owner
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('${michelleWsId}', '${mg?.id}', 'owner', 'active', NOW());

-- Add Irish to her workspace as owner
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('${irishWsId}', '${im?.id}', 'owner', 'active', NOW());

-- Add Charissa to her workspace as owner
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('${charissaWsId}', '${cs?.id}', 'owner', 'active', NOW());

-- Keep Thorsten as owner in InnovareAI
UPDATE workspace_members
SET role = 'owner'
WHERE workspace_id = '${originalWorkspaceId}'
  AND user_id = '${tl?.id}';

-- ========================================
-- ADD SERVICE ACCOUNTS (Justin, Catherine) TO ALL WORKSPACES
-- ========================================

-- Add Justin and Catherine as admin to Michelle's workspace
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES
  ('${michelleWsId}', '${jf?.id}', 'admin', 'active', NOW()),
  ('${michelleWsId}', '${cl?.id}', 'admin', 'active', NOW());

-- Add Justin and Catherine as admin to Irish's workspace
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES
  ('${irishWsId}', '${jf?.id}', 'admin', 'active', NOW()),
  ('${irishWsId}', '${cl?.id}', 'admin', 'active', NOW());

-- Add Justin and Catherine as admin to Charissa's workspace
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES
  ('${charissaWsId}', '${jf?.id}', 'admin', 'active', NOW()),
  ('${charissaWsId}', '${cl?.id}', 'admin', 'active', NOW');

-- Keep Justin and Catherine as admin in Thorsten's workspace (already there)

-- ========================================
-- MOVE LINKEDIN ACCOUNTS
-- ========================================

-- Move Michelle's LinkedIn account to her workspace
UPDATE workspace_accounts
SET workspace_id = '${michelleWsId}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND unipile_account_id = 'MT39bAEDTJ6e_ZPY337UgQ';

-- Move Irish's LinkedIn account to her workspace
UPDATE workspace_accounts
SET workspace_id = '${irishWsId}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND unipile_account_id = 'avp6xHsCRZaP5uSPmjc2jg';

-- Move Charissa's LinkedIn account to her workspace
UPDATE workspace_accounts
SET workspace_id = '${charissaWsId}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND unipile_account_id = '4nt1J-blSnGUPBjH2Nfjpg';

-- Thorsten's LinkedIn account remains in InnovareAI workspace
-- (unipile_account_id: mERQmojtSZq5GeomZZazlw)

-- ========================================
-- MOVE CAMPAIGNS TO RESPECTIVE WORKSPACES
-- ========================================

-- Move Michelle's campaigns
UPDATE campaigns
SET workspace_id = '${michelleWsId}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND created_by = '${mg?.id}';

-- Move Irish's campaigns
UPDATE campaigns
SET workspace_id = '${irishWsId}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND created_by = '${im?.id}';

-- Move Charissa's campaigns
UPDATE campaigns
SET workspace_id = '${charissaWsId}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND created_by = '${cs?.id}';

-- Thorsten's campaigns remain in InnovareAI workspace

-- ========================================
-- MOVE PROSPECTS TO RESPECTIVE WORKSPACES
-- ========================================

-- Move Michelle's prospects
UPDATE campaign_prospects cp
SET workspace_id = '${michelleWsId}'
FROM campaigns c
WHERE cp.campaign_id = c.id
  AND c.created_by = '${mg?.id}';

-- Move Irish's prospects
UPDATE campaign_prospects cp
SET workspace_id = '${irishWsId}'
FROM campaigns c
WHERE cp.campaign_id = c.id
  AND c.created_by = '${im?.id}';

-- Move Charissa's prospects
UPDATE campaign_prospects cp
SET workspace_id = '${charissaWsId}'
FROM campaigns c
WHERE cp.campaign_id = c.id
  AND c.created_by = '${cs?.id}';

-- ========================================
-- DONE!
-- ========================================
`;

  console.log(sql);

  console.log('\n✅ Copy and paste the SQL above into Supabase SQL Editor');
  console.log('   Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new\n');

  console.log('📊 RESULT:');
  console.log('  InnovareAI → Thorsten (tl@innovareai.com) + Justin + Catherine');
  console.log('  IAI-Michelle → Michelle (mg@innovareai.com) + Justin + Catherine');
  console.log('  IAI-Irish → Irish (im@innovareai.com) + Justin + Catherine');
  console.log('  IAI-Charissa → Charissa (cs@innovareai.com) + Justin + Catherine');
}

splitInnovare().catch(console.error);
