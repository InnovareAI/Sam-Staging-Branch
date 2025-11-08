const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function splitInnovare() {
  console.log('🔄 Splitting InnovareAI into isolated workspaces...\n');

  const originalWorkspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  // Generate new workspace IDs
  const ia2Id = crypto.randomUUID(); // Michelle
  const ia3Id = crypto.randomUUID(); // Irish
  const ia4Id = crypto.randomUUID(); // Charissa

  // Get all users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  const tl = users.find(u => u.email === 'tl@innovareai.com');
  const mg = users.find(u => u.email === 'mg@innovareai.com');
  const im = users.find(u => u.email === 'im@innovareai.com');
  const cs = users.find(u => u.email === 'cs@innovareai.com');
  const jf = users.find(u => u.email === 'jf@innovareai.com');
  const cl = users.find(u => u.email === 'cl@innovareai.com');

  console.log('👥 User IDs:');
  console.log(`  tl@innovareai.com (Thorsten): ${tl?.id}`);
  console.log(`  mg@innovareai.com (Michelle): ${mg?.id}`);
  console.log(`  im@innovareai.com (Irish): ${im?.id}`);
  console.log(`  cs@innovareai.com (Charissa): ${cs?.id}`);
  console.log(`  jf@innovareai.com (Jennifer): ${jf?.id}`);
  console.log(`  cl@innovareai.com (Catherine): ${cl?.id}\n`);

  console.log('📋 Workspace IDs:');
  console.log(`  IA1 (Thorsten): ${originalWorkspaceId} (keep existing)`);
  console.log(`  IA2 (Michelle): ${ia2Id}`);
  console.log(`  IA3 (Irish): ${ia3Id}`);
  console.log(`  IA4 (Charissa): ${ia4Id}\n`);

  console.log('📁 SQL to execute in Supabase dashboard:\n');
  console.log('═══════════════════════════════════════════════════\n');

  const sql = `
-- ========================================
-- SPLIT INNOVAREAI INTO ISOLATED WORKSPACES
-- NO SHARED ACCOUNTS - EACH WORKSPACE HAS ONLY 1 OWNER
-- ========================================

-- 1. Rename original workspace to IA1 (Thorsten)
UPDATE workspaces
SET name = 'IA1'
WHERE id = '${originalWorkspaceId}';

-- 2. Create IA2 (Michelle)
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('${ia2Id}', 'IA2', NOW(), NOW());

-- 3. Create IA3 (Irish)
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('${ia3Id}', 'IA3', NOW(), NOW());

-- 4. Create IA4 (Charissa)
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('${ia4Id}', 'IA4', NOW(), NOW());

-- ========================================
-- REMOVE ALL MEMBERS EXCEPT THORSTEN FROM IA1
-- ========================================

DELETE FROM workspace_members
WHERE workspace_id = '${originalWorkspaceId}'
  AND user_id != '${tl?.id}';

-- Ensure Thorsten is owner in IA1
UPDATE workspace_members
SET role = 'owner'
WHERE workspace_id = '${originalWorkspaceId}'
  AND user_id = '${tl?.id}';

-- ========================================
-- ADD OWNERS TO NEW WORKSPACES (ONE OWNER EACH)
-- ========================================

-- Add Michelle as ONLY owner in IA2
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('${ia2Id}', '${mg?.id}', 'owner', 'active', NOW());

-- Add Irish as ONLY owner in IA3
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('${ia3Id}', '${im?.id}', 'owner', 'active', NOW());

-- Add Charissa as ONLY owner in IA4
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('${ia4Id}', '${cs?.id}', 'owner', 'active', NOW());

-- ========================================
-- MOVE LINKEDIN ACCOUNTS TO RESPECTIVE WORKSPACES
-- ========================================

-- Move Michelle's LinkedIn account to IA2
UPDATE workspace_accounts
SET workspace_id = '${ia2Id}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND unipile_account_id = 'MT39bAEDTJ6e_ZPY337UgQ';

-- Move Irish's LinkedIn account to IA3
UPDATE workspace_accounts
SET workspace_id = '${ia3Id}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND unipile_account_id = 'avp6xHsCRZaP5uSPmjc2jg';

-- Move Charissa's LinkedIn account to IA4
UPDATE workspace_accounts
SET workspace_id = '${ia4Id}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND unipile_account_id = '4nt1J-blSnGUPBjH2Nfjpg';

-- Thorsten's LinkedIn account remains in IA1
-- (unipile_account_id: mERQmojtSZq5GeomZZazlw)

-- ========================================
-- MOVE CAMPAIGNS TO RESPECTIVE WORKSPACES
-- ========================================

-- Move Michelle's campaigns to IA2
UPDATE campaigns
SET workspace_id = '${ia2Id}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND created_by = '${mg?.id}';

-- Move Irish's campaigns to IA3
UPDATE campaigns
SET workspace_id = '${ia3Id}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND created_by = '${im?.id}';

-- Move Charissa's campaigns to IA4
UPDATE campaigns
SET workspace_id = '${ia4Id}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND created_by = '${cs?.id}';

-- Thorsten's campaigns remain in IA1

-- ========================================
-- MOVE CAMPAIGN PROSPECTS TO RESPECTIVE WORKSPACES
-- ========================================

-- Move Michelle's prospects to IA2
UPDATE campaign_prospects cp
SET workspace_id = '${ia2Id}'
FROM campaigns c
WHERE cp.campaign_id = c.id
  AND c.created_by = '${mg?.id}';

-- Move Irish's prospects to IA3
UPDATE campaign_prospects cp
SET workspace_id = '${ia3Id}'
FROM campaigns c
WHERE cp.campaign_id = c.id
  AND c.created_by = '${im?.id}';

-- Move Charissa's prospects to IA4
UPDATE campaign_prospects cp
SET workspace_id = '${ia4Id}'
FROM campaigns c
WHERE cp.campaign_id = c.id
  AND c.created_by = '${cs?.id}';

-- ========================================
-- MOVE OTHER DATA (if any)
-- ========================================

-- Move workspace_prospects
UPDATE workspace_prospects
SET workspace_id = '${ia2Id}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND created_by = '${mg?.id}';

UPDATE workspace_prospects
SET workspace_id = '${ia3Id}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND created_by = '${im?.id}';

UPDATE workspace_prospects
SET workspace_id = '${ia4Id}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND created_by = '${cs?.id}';

-- Move prospect_approval_data
UPDATE prospect_approval_data
SET workspace_id = '${ia2Id}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND created_by = '${mg?.id}';

UPDATE prospect_approval_data
SET workspace_id = '${ia3Id}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND created_by = '${im?.id}';

UPDATE prospect_approval_data
SET workspace_id = '${ia4Id}'
WHERE workspace_id = '${originalWorkspaceId}'
  AND created_by = '${cs?.id}';

-- ========================================
-- DONE!
-- ========================================
`;

  console.log(sql);

  console.log('\n✅ Copy and paste the SQL above into Supabase SQL Editor');
  console.log('   Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new\n');

  console.log('📊 RESULT - 4 ISOLATED WORKSPACES:');
  console.log('  IA1 → Thorsten ONLY (tl@innovareai.com)');
  console.log('  IA2 → Michelle ONLY (mg@innovareai.com)');
  console.log('  IA3 → Irish ONLY (im@innovareai.com)');
  console.log('  IA4 → Charissa ONLY (cs@innovareai.com)\n');

  console.log('⚠️  NOTE: Jennifer (jf@innovareai.com) and Catherine (cl@innovareai.com)');
  console.log('   are NOT added to any workspace. Create separate workspaces for them if needed.');
}

splitInnovare().catch(console.error);
