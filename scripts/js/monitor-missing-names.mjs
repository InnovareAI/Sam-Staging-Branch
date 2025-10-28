import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 MONITORING: Checking for prospects without names...\n');

// Check for prospects in executable statuses without names
const { data: missingNames, error } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, linkedin_url, campaign_id, campaigns(name, workspace_id, workspaces(name))')
  .or('first_name.is.null,last_name.is.null,first_name.eq.,last_name.eq.')
  .in('status', ['pending', 'approved', 'ready_to_message'])
  .not('linkedin_url', 'is', null);

if (error) {
  console.error('❌ Error checking for missing names:', error.message);
  process.exit(1);
}

if (!missingNames || missingNames.length === 0) {
  console.log('✅ ALL PROSPECTS HAVE NAMES');
  console.log('✅ No action needed\n');
  process.exit(0);
}

// 🚨 ALERT: Found prospects without names
console.log('🚨 ALERT: FOUND PROSPECTS WITHOUT NAMES 🚨\n');
console.log(`⚠️  ${missingNames.length} prospects are ready to be sent but missing names\n`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Group by workspace
const byWorkspace = new Map();
for (const p of missingNames) {
  const wsName = p.campaigns?.workspaces?.name || 'Unknown';
  if (!byWorkspace.has(wsName)) {
    byWorkspace.set(wsName, []);
  }
  byWorkspace.get(wsName).push(p);
}

for (const [wsName, prospects] of byWorkspace.entries()) {
  console.log(`\n${wsName}: ${prospects.length} prospects`);
  for (const p of prospects) {
    console.log(`  - ${p.linkedin_url}`);
    console.log(`    Status: ${p.status}`);
    console.log(`    Campaign: ${p.campaigns?.name || 'Unknown'}`);
    console.log(`    First: "${p.first_name || ''}"`);
    console.log(`    Last: "${p.last_name || ''}"`);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 RECOMMENDED ACTION:\n');
console.log('Run the name extraction script:');
console.log('  node scripts/js/fix-missing-names.mjs\n');

console.log('🚨 These prospects will be BLOCKED from sending until names are added');
console.log('🚨 The execute-live route now refuses to send messages without names\n');

// Exit with error code to trigger alerts in monitoring systems
process.exit(1);
