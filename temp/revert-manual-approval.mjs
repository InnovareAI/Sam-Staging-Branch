import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔄 REVERTING MANUAL APPROVAL - Prospect e49405d2\n');

const prospectId = 'e49405d2-9b49-4192-9d70-7007cf7df7ac';

// Check current status
const { data: before } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, validation_status')
  .eq('id', prospectId)
  .single();

console.log('Current status:');
console.log(`  Name: ${before.first_name} ${before.last_name}`);
console.log(`  Status: ${before.status}`);
console.log(`  Validation: ${before.validation_status}`);

// Revert to pending so user can manually approve
const { error } = await supabase
  .from('campaign_prospects')
  .update({
    status: 'pending'
  })
  .eq('id', prospectId);

if (error) {
  console.error('\n❌ Error reverting:', error.message);
} else {
  console.log('\n✅ Reverted to pending status');
  console.log('   User must now approve manually via approval UI');
}

// Verify
const { data: after } = await supabase
  .from('campaign_prospects')
  .select('status')
  .eq('id', prospectId)
  .single();

console.log(`\nVerification: ${after.status}`);
console.log('\n');
