const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function splitSendingcell() {
  console.log('🔄 Splitting Sendingcell workspace (manual approach)...\n');

  const sc2WorkspaceId = 'b070d94f-11e2-41d4-a913-cc5a8c017208'; // Original Sendingcell
  const sc1WorkspaceId = crypto.randomUUID(); // New workspace for Jim

  // Get all users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  const jim = users.find(u => u.email === 'jim.heim@sendingcell.com');
  const dave = users.find(u => u.email === 'dave.stuteville@sendingcell.com');
  const cathy = users.find(u => u.email === 'cathy.smith@sendingcell.com');

  console.log('👥 Found users:');
  console.log(`  Jim: ${jim?.id}`);
  console.log(`  Dave: ${dave?.id}`);
  console.log(`  Cathy: ${cathy?.id}\n`);

  console.log(`📋 Generated SC1 workspace ID: ${sc1WorkspaceId}\n`);

  // Manually insert SC1 workspace using service role bypassing RLS
  console.log('📁 Creating SC1 workspace (bypassing RLS)...\n');
  console.log('Run this SQL in Supabase dashboard:\n');
  console.log(`
-- Create SC1 workspace
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('${sc1WorkspaceId}', 'SC1', NOW(), NOW());

-- Rename original to SC2
UPDATE workspaces
SET name = 'SC2'
WHERE id = '${sc2WorkspaceId}';

-- Move Jim to SC1 as owner
DELETE FROM workspace_members
WHERE workspace_id = '${sc2WorkspaceId}'
  AND user_id = '${jim.id}';

INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('${sc1WorkspaceId}', '${jim.id}', 'owner', 'active', NOW());

-- Update Dave to owner in SC2
UPDATE workspace_members
SET role = 'owner'
WHERE workspace_id = '${sc2WorkspaceId}'
  AND user_id = '${dave.id}';

-- Move Jim's LinkedIn account to SC1
UPDATE workspace_accounts
SET workspace_id = '${sc1WorkspaceId}'
WHERE workspace_id = '${sc2WorkspaceId}'
  AND unipile_account_id = 'J6pyDIoQSfmGDEIbwXBy3A';

-- Add Cathy to SC1 as admin
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('${sc1WorkspaceId}', '${cathy.id}', 'admin', 'active', NOW());
  `);

  console.log('\n✅ Copy and paste the SQL above into Supabase SQL Editor');
  console.log('   Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new');
}

splitSendingcell().catch(console.error);
