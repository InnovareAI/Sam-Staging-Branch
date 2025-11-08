const crypto = require('crypto');

const ia5Id = crypto.randomUUID();
const jenniferUserId = 'a4c3ff4d-ac9c-4e84-9b35-967ce6ff8189';

console.log('📋 Creating IA5 for Jennifer...\n');
console.log(`Workspace ID: ${ia5Id}`);
console.log(`User ID: ${jenniferUserId}\n`);

console.log('📁 SQL to add to the InnovareAI split script:\n');
console.log('═══════════════════════════════════════════════════\n');

const sql = `
-- ========================================
-- CREATE IA5 FOR JENNIFER
-- ========================================

-- Create IA5 workspace
INSERT INTO workspaces (id, name, created_at, updated_at)
VALUES ('${ia5Id}', 'IA5', NOW(), NOW());

-- Add Jennifer as owner in IA5
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES ('${ia5Id}', '${jenniferUserId}', 'owner', 'active', NOW());

-- NOTE: Jennifer has no LinkedIn accounts or campaigns to move
-- IA5 will be an empty workspace for now
`;

console.log(sql);

console.log('\n✅ Add this SQL to the InnovareAI split script');
console.log('   or run it separately after the main split\n');

console.log('📊 RESULT:');
console.log('  IA5 → Jennifer ONLY (jf@innovareai.com)');
console.log('  No LinkedIn accounts or campaigns (empty workspace)');
