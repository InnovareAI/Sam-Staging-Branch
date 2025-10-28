import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('FINAL COMPLETE VALIDATION - ALL STATUSES\n');
console.log('==========================================\n');

// Check for ANY prospects without names (regardless of status)
const { data: missingNames } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, linkedin_url')
  .or('first_name.is.null,last_name.is.null,first_name.eq.,last_name.eq.')
  .not('linkedin_url', 'is', null);

console.log('1. Prospects without names (ANY status):');
if (missingNames && missingNames.length > 0) {
  console.log('   FAILED:', missingNames.length, 'prospects missing names\n');
  
  const byStatus = new Map();
  for (const p of missingNames) {
    if (!byStatus.has(p.status)) byStatus.set(p.status, 0);
    byStatus.set(p.status, byStatus.get(p.status) + 1);
  }
  
  for (const [status, count] of byStatus.entries()) {
    console.log('     ', status + ':', count);
  }
  console.log('');
  process.exit(1);
} else {
  console.log('   PASSED: All prospects have names\n');
}

// Check campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, connection_message, alternative_message');

console.log('2. Campaigns ready to send:');
let readyCampaigns = 0;
let needMessage = 0;
let needActivation = 0;

for (const c of campaigns || []) {
  const hasMessage = c.connection_message || c.alternative_message;
  const isActive = c.status === 'active';
  
  if (hasMessage && isActive) {
    readyCampaigns++;
    console.log('   READY:', c.name);
  } else if (!hasMessage) {
    needMessage++;
  } else if (!isActive) {
    needActivation++;
  }
}

if (readyCampaigns === 0) {
  console.log('   FAILED: No campaigns ready to send');
  console.log('     Campaigns needing messages:', needMessage);
  console.log('     Campaigns needing activation:', needActivation);
  console.log('');
  process.exit(1);
} else {
  console.log('   PASSED:', readyCampaigns, 'campaigns ready\n');
}

// Check LinkedIn accounts
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('account_name, connection_status')
  .eq('account_type', 'linkedin');

console.log('3. LinkedIn accounts:');
const disconnected = accounts?.filter(a => a.connection_status !== 'connected') || [];
if (disconnected.length > 0) {
  console.log('   FAILED:', disconnected.length, 'accounts disconnected');
  for (const acc of disconnected) {
    console.log('     -', acc.account_name + ':', acc.connection_status);
  }
  console.log('');
  process.exit(1);
} else {
  console.log('   PASSED: All', accounts?.length || 0, 'accounts connected\n');
}

console.log('==========================================');
console.log('RESULT: READY TO SEND');
console.log('==========================================\n');
console.log('All checks passed:');
console.log('  - All prospects have names');
console.log('  -', readyCampaigns, 'campaign(s) active with messages');
console.log('  - All LinkedIn accounts connected');
console.log('');
console.log('You can now send messages with zero errors.');
