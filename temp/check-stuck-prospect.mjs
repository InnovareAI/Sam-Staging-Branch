import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 CHECKING STUCK PROSPECT e49405d2\n');

// Get the specific prospect
const { data: prospect } = await supabase
  .from('campaign_prospects')
  .select('*')
  .ilike('id', 'e49405d2%')
  .single();

if (prospect) {
  console.log('Found prospect:');
  console.log(`  ID: ${prospect.id}`);
  console.log(`  Name: ${prospect.name || 'NULL'}`);
  console.log(`  Status: ${prospect.status}`);
  console.log(`  Approval Status: ${prospect.approval_status || 'NULL'}`);
  console.log(`  Created: ${new Date(prospect.created_at).toLocaleString()}`);
  console.log(`  Campaign: ${prospect.campaign_id || 'NULL'}`);
  console.log(`  Workspace: ${prospect.workspace_id || 'NULL'}`);

  const daysOld = Math.floor((Date.now() - new Date(prospect.created_at).getTime()) / (1000 * 60 * 60 * 24));
  console.log(`  Days old: ${daysOld}`);

  // Check if it's in a transitional status
  const transitionalStatuses = ['uploading', 'validating', 'processing'];
  if (transitionalStatuses.includes(prospect.status)) {
    console.log('\n⚠️  STUCK: Prospect is in transitional status for >3 days');

    // Determine correct final status
    let newStatus = 'pending_approval';
    if (prospect.approval_status === 'approved') {
      newStatus = 'approved';
    } else if (prospect.approval_status === 'rejected') {
      newStatus = 'rejected';
    }

    console.log(`  Recommended fix: ${prospect.status} → ${newStatus}`);
  } else {
    console.log('\n✅ Prospect is in a final status (not stuck)');
  }
} else {
  console.log('❌ Prospect not found');
}

console.log('\n');
