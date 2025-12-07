import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔧 FIXING STUCK PENDING PROSPECT e49405d2\n');

const prospectId = 'e49405d2-9b49-4192-9d70-7007cf7df7ac';

// Get full prospect details
const { data: prospect } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('id', prospectId)
  .single();

console.log('Current state:');
console.log(`  ID: ${prospect.id}`);
console.log(`  Name: ${prospect.name || 'NULL'}`);
console.log(`  Status: ${prospect.status}`);
console.log(`  Approval Status: ${prospect.approval_status || 'NULL'}`);
console.log(`  LinkedIn URL: ${prospect.linkedin_url}`);
console.log(`  Campaign: ${prospect.campaign_id}`);

// Extract name from LinkedIn URL
let extractedName = null;
if (prospect.linkedin_url) {
  const match = prospect.linkedin_url.match(/linkedin\.com\/in\/([^\/\?#]+)/);
  if (match) {
    const vanity = match[1];
    // Convert vanity to name (allennatian -> Allen Natian)
    extractedName = vanity
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

console.log(`\nExtracted name from URL: ${extractedName || 'Failed'}`);

// Get campaign details
const { data: campaign } = await supabase
  .from('campaigns')
  .select('name, status')
  .eq('id', prospect.campaign_id)
  .single();

console.log(`\nCampaign: ${campaign?.name || 'Unknown'} (${campaign?.status || 'Unknown'})`);

// Determine correct status
let newStatus = 'pending_approval';
let updates = {};

if (extractedName) {
  updates.name = extractedName;
}

// If prospect has been pending for >3 days and has no name, it's likely stuck in upload
// Move it to pending_approval so it can be processed
if (prospect.status === 'pending' && !prospect.name) {
  updates.status = 'pending_approval';
}

if (Object.keys(updates).length > 0) {
  console.log('\nApplying fixes:');
  Object.entries(updates).forEach(([key, value]) => {
    console.log(`  ${key}: ${prospect[key] || 'NULL'} → ${value}`);
  });

  const { error } = await supabase
    .from('campaign_prospects')
    .update(updates)
    .eq('id', prospectId);

  if (error) {
    console.error('\n❌ Error updating prospect:', error.message);
  } else {
    console.log('\n✅ Prospect fixed successfully');
  }
} else {
  console.log('\n⚠️  No updates needed');
}

console.log('\n');
