require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function showAllProspects() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('🔍 ALL PROSPECTS IN STAN\'S WORKSPACE\n');
  console.log('=' .repeat(70));

  // Get all prospects
  const { data: prospects } = await supabase
    .from('workspace_prospects')
    .select('id, first_name, last_name, title, company, industry, approval_status, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50);

  console.log(`\nShowing first 50 of ${prospects?.length || 0} prospects:\n`);

  // Group by approval status
  const approved = prospects?.filter(p => p.approval_status === 'approved') || [];
  const rejected = prospects?.filter(p => p.approval_status === 'rejected') || [];
  const pending = prospects?.filter(p => !p.approval_status || p.approval_status === 'pending') || [];

  console.log('STATUS SUMMARY:');
  console.log(`  ✅ Approved: ${approved.length}`);
  console.log(`  ⛔ Rejected: ${rejected.length}`);
  console.log(`  ⏳ Pending/Other: ${pending.length}\n`);

  // Show approved
  if (approved.length > 0) {
    console.log('=' .repeat(70));
    console.log(`\n✅ APPROVED PROSPECTS (${approved.length}):\n`);
    approved.forEach((p, i) => {
      console.log(`${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name}`);
      console.log(`    Title: ${p.title || 'N/A'}`);
      console.log(`    Company: ${p.company || 'N/A'}`);
      console.log(`    Industry: ${p.industry || 'N/A'}`);
      console.log(`    Created: ${new Date(p.created_at).toLocaleDateString()}`);
      console.log('');
    });
  }

  // Show rejected
  if (rejected.length > 0) {
    console.log('=' .repeat(70));
    console.log(`\n⛔ REJECTED PROSPECTS (${rejected.length}):\n`);
    rejected.slice(0, 20).forEach((p, i) => {
      console.log(`${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name} - ${p.title || 'N/A'} at ${p.company || 'N/A'}`);
    });
    if (rejected.length > 20) {
      console.log(`\n   ... and ${rejected.length - 20} more rejected`);
    }
  }

  // Show pending
  if (pending.length > 0) {
    console.log('\n' + '=' .repeat(70));
    console.log(`\n⏳ PENDING/OTHER (${pending.length}):\n`);
    pending.slice(0, 20).forEach((p, i) => {
      console.log(`${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name} - ${p.approval_status || 'no status'}`);
      console.log(`    ${p.title || 'N/A'} at ${p.company || 'N/A'}`);
    });
    if (pending.length > 20) {
      console.log(`\n   ... and ${pending.length - 20} more`);
    }
  }

  console.log('\n' + '=' .repeat(70));
  console.log(`\nWorkspace ID: ${workspaceId}\n`);
}

showAllProspects().catch(console.error);
